// Copyright 2023, University of Colorado Boulder

/**
 * A raked scan implementation capable of non-commutable cases, where:
 *
 * 1. All threads load state into workgroup memory in a coalesced fashion
 * 2. All threads perform an inclusive sequential scan on their data (of grainSize elements)
 * 3. All threads perform an inclusive scan of the "reuced" values for each thread (Hillis-Steele)
 * 4. The remaining values are filled in with the previous scanned value.workgroup
 * 5. The workgroup memory is written to the main output in a coalesced fashion
 *
 * Based on the described coarsened scan in "Programming Massively Parallel Processors" by Hwu, Kirk and Hajj, chap11.
 *
 * Additionally, reductions can be stored in a separate array (for use in multi-level scans), AND/OR
 * scanned reductions can be added into final results (also for use in multi-level scans).
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, binaryExpressionStatementWGSL, BinaryOp, Binding, RakedSizable, scanComprehensiveWGSL, scanComprehensiveWGSLOptions, u32, WGSLContext, WGSLExpressionT, WGSLExpressionU32, WGSLStatements } from '../../../imports.js';
import { optionize3 } from '../../../../../phet-core/js/optionize.js';

// TODO: use multiple named types to simplify this boolean "mess"
type SelfOptions<T> = {
  binaryOp: BinaryOp<T>;
  inPlace?: boolean;
  storeReduction?: boolean;
  addScannedReduction?: boolean;
  addScannedDoubleReduction?: boolean;
  areScannedReductionsExclusive?: boolean;
} & RakedSizable & ( {
  inPlace?: false;
  bindings: {
    input: Binding;
    output: Binding;
  };
} | {
  inPlace: true;
  bindings: {
    data: Binding;
  };
} ) & ( {
  storeReduction?: false;
} | {
  storeReduction: true;
  bindings: {
    reduction: Binding;
  };
} ) & ( ( {
  addScannedReduction?: false;
} & Pick<scanComprehensiveWGSLOptions<T>, 'getAddedValue'> ) | ( {
  addScannedReduction: true;
  bindings: {
    scannedReduction: Binding;
  };
} & ( {
  addScannedDoubleReduction?: false;
} | {
  addScannedDoubleReduction: true;
  bindings: {
    scannedDoubleReduction: Binding;
  };
} ) ) );

export type mainScanWGSLOptions<T> = SelfOptions<T> & Pick<scanComprehensiveWGSLOptions<T>,
  'exclusive' | 'lengthExpression' | 'inputOrder' | 'inputAccessOrder' | 'factorOutSubexpressions' | 'stripeReducedOutput'
>;

export const MAIN_SCAN_DEFAULTS = {
  inPlace: false,
  storeReduction: false,
  addScannedReduction: false,
  addScannedDoubleReduction: false,
  areScannedReductionsExclusive: false
} as const;

const mainScanWGSL = <T>(
  context: WGSLContext,
  providedOptions: mainScanWGSLOptions<T>
): WGSLStatements => {

  // TODO: how to specify that we don't fill in defaults for things like factorOutSubexpressions?
  const options = optionize3<mainScanWGSLOptions<T>, SelfOptions<T>>()( {}, MAIN_SCAN_DEFAULTS, providedOptions );

  const binaryOp = options.binaryOp;
  const workgroupSize = options.workgroupSize;
  const grainSize = options.grainSize;

  return `
    
    ${options.inPlace ? `
      ${options.bindings.data.location.getWGSLAnnotation()}
      var<storage, ${options.bindings.data.getStorageAccess()}> data: array<${binaryOp.type.valueType}>;
    ` : `
      ${options.bindings.input.location.getWGSLAnnotation()}
      var<storage, ${options.bindings.input.getStorageAccess()}> input: array<${binaryOp.type.valueType}>;
      ${options.bindings.output.location.getWGSLAnnotation()}
      var<storage, ${options.bindings.output.getStorageAccess()}> output: array<${binaryOp.type.valueType}>;
    `}
    ${options.storeReduction ? `
      ${options.bindings.reduction.location.getWGSLAnnotation()}
      var<storage, ${options.bindings.reduction.getStorageAccess()}> reduction: array<${binaryOp.type.valueType}>;
    ` : ''}
    ${options.addScannedReduction ? `
      ${options.bindings.scannedReduction.location.getWGSLAnnotation()}
      var<storage, ${options.bindings.scannedReduction.getStorageAccess()}> scanned_reduction: array<${binaryOp.type.valueType}>;
      ${options.addScannedDoubleReduction ? `
        ${options.bindings.scannedDoubleReduction.location.getWGSLAnnotation()}
        var<storage, ${options.bindings.scannedDoubleReduction.getStorageAccess()}> scanned_double_reduction: array<${binaryOp.type.valueType}>;
      ` : ''}
      
      var<workgroup> reduction_value: ${binaryOp.type.valueType};
    ` : ''}
    
    var<workgroup> scratch: array<${binaryOp.type.valueType}, ${workgroupSize * grainSize}>;
    
    @compute @workgroup_size(${workgroupSize})
    fn main(
      @builtin(global_invocation_id) global_id: vec3u,
      @builtin(local_invocation_id) local_id: vec3u,
      @builtin(workgroup_id) workgroup_id: vec3u
    ) {
      ${scanComprehensiveWGSL( context, {
        input: options.inPlace ? 'data' : 'input',
        output: options.inPlace ? 'data' : 'output',
        scratch: 'scratch',
        binaryOp: binaryOp,
        workgroupSize: workgroupSize,
        grainSize: grainSize,
        exclusive: options.exclusive,
        lengthExpression: options.lengthExpression,
        inputOrder: options.inputOrder,
        inputAccessOrder: options.inputAccessOrder,
        factorOutSubexpressions: options.factorOutSubexpressions,
        // TODO: combine these two approaches if possible?
        getAddedValue: options.addScannedReduction ? ( options.addScannedDoubleReduction ? addedValue => `
          if ( local_id.x == 0u ) {
            // If our reductions are scanned exclusively, then we can just use the value directly
            ${options.areScannedReductionsExclusive ? `
              let middle_value = scanned_reduction[ workgroup_id.x ];
              let lower_value = double_scanned_reduction[ workgroup_id.x / ${u32( workgroupSize * grainSize )} ];
            ` : `
              var middle_value: ${binaryOp.type.valueType};
              var lower_value: ${binaryOp.type.valueType};
              // NOTE: assumes the same workgroup/grain size for each level
              // This should work for any level of workgroup handling
              if ( workgroup_id.x % ${u32( workgroupSize * grainSize )} == 0u ) {
                middle_value = ${binaryOp.identityWGSL};
              }
              else {
                middle_value = scanned_reduction[ workgroup_id.x - 1u ];
              }
              let lower_index = workgroup_id.x / ${u32( workgroupSize * grainSize )};
              if ( lower_index % ${u32( workgroupSize * grainSize )} == 0u ) {
                lower_value = ${binaryOp.identityWGSL};
              }
              else {
                lower_value = double_scanned_reduction[ lower_index - 1u ];
              }
            `}
    
            ${binaryExpressionStatementWGSL( 'reduction_value', binaryOp.combineExpression || null, binaryOp.combineStatements || null, 'lower_value', 'middle_value' )}
          }
    
          workgroupBarrier();
    
          ${addedValue} = reduction_value;
        ` : addedValue => `
          if ( local_id.x == 0u ) {
            // If our reductions are scanned exclusively, then we can just use the value directly
            ${options.areScannedReductionsExclusive ? `
              reduction_value = scanned_reduction[ workgroup_id.x ];
            ` : `
              // NOTE: assumes the same workgroup/grain size for each level
              // This should work for any level of workgroup handling
              if ( workgroup_id.x % ${u32( workgroupSize * grainSize )} == 0u ) {
                reduction_value = ${binaryOp.identityWGSL};
              }
              else {
                reduction_value = scanned_reduction[ workgroup_id.x - 1u ];
              }
            `}
          }
    
          workgroupBarrier();
    
          ${addedValue} = reduction_value;
        ` ) : options.getAddedValue,
        storeReduction: options.storeReduction ? ( index: WGSLExpressionU32, value: WGSLExpressionT ) => `reduction[ ${index} ] = ${value};` : null
      } )}
    }

  `;
};

export default mainScanWGSL;

alpenglow.register( 'mainScanWGSL', mainScanWGSL );