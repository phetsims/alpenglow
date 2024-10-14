// Copyright 2023-2024, University of Colorado Boulder

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

import { alpenglow, binaryExpressionStatementWGSL, BinaryOp, BufferBindingType, BufferSlot, decimalS, RakedSizable, scanComprehensiveWGSL, scanComprehensiveWGSLOptions, u32S, wgsl, WGSLExpressionT, WGSLExpressionU32, WGSLMainModule, WGSLSlot } from '../../../imports.js';
import { optionize3 } from '../../../../../phet-core/js/optionize.js';

type SelfOptions<T> = {
  binaryOp: BinaryOp<T>;
  inPlace?: boolean;
  storeReduction?: boolean;
  addScannedReduction?: boolean;
  addScannedDoubleReduction?: boolean;
  areScannedReductionsExclusive?: boolean;

  // Iff inPlace:false
  input?: BufferSlot<T[]> | null;
  output?: BufferSlot<T[]> | null;

  // Iff inPlace:true
  data?: BufferSlot<T[]> | null;

  // iff storeReduction:true
  reduction?: BufferSlot<T[]> | null;

  // iff addScannedReduction:true
  scannedReduction?: BufferSlot<T[]> | null;

  // iff addScannedDoubleReduction:true
  scannedDoubleReduction?: BufferSlot<T[]> | null;

  // only if addScannedReduction:false
  getAddedValue?: scanComprehensiveWGSLOptions<T>[ 'getAddedValue' ];
} & RakedSizable;

export type mainScanWGSLOptions<T> = SelfOptions<T> & Pick<scanComprehensiveWGSLOptions<T>,
  'exclusive' | 'lengthExpression' | 'inputOrder' | 'inputAccessOrder' | 'factorOutSubexpressions' | 'stripeReducedOutput'
>;

export const MAIN_SCAN_DEFAULTS = {
  inPlace: false,
  storeReduction: false,
  addScannedReduction: false,
  addScannedDoubleReduction: false,
  areScannedReductionsExclusive: false,
  input: null,
  output: null,
  data: null,
  reduction: null,
  scannedReduction: null,
  scannedDoubleReduction: null,
  getAddedValue: null
} as const;

const mainScanWGSL = <T>(
  providedOptions: mainScanWGSLOptions<T>
): WGSLMainModule => {

  // TODO: how to specify that we don't fill in defaults for things like factorOutSubexpressions?
  const options = optionize3<mainScanWGSLOptions<T>, SelfOptions<T>>()( {}, MAIN_SCAN_DEFAULTS, providedOptions );

  const binaryOp = options.binaryOp;
  const workgroupSize = options.workgroupSize;
  const grainSize = options.grainSize;

  const slots: WGSLSlot[] = [];

  if ( options.inPlace ) {
    assert && assert( options.data );
    slots.push( new WGSLSlot( 'data', options.data!, BufferBindingType.STORAGE ) );
  }
  else {
    assert && assert( options.input );
    assert && assert( options.output );
    slots.push( new WGSLSlot( 'input', options.input!, BufferBindingType.READ_ONLY_STORAGE ) );
    slots.push( new WGSLSlot( 'output', options.output!, BufferBindingType.STORAGE ) );
  }
  if ( options.storeReduction ) {
    assert && assert( options.reduction );
    slots.push( new WGSLSlot( 'reduction', options.reduction!, BufferBindingType.STORAGE ) );
  }
  if ( options.addScannedReduction ) {
    assert && assert( options.scannedReduction );
    slots.push( new WGSLSlot( 'scanned_reduction', options.scannedReduction!, BufferBindingType.READ_ONLY_STORAGE ) );

    if ( options.addScannedDoubleReduction ) {
      assert && assert( options.scannedDoubleReduction );
      slots.push( new WGSLSlot( 'double_scanned_reduction', options.scannedDoubleReduction!, BufferBindingType.READ_ONLY_STORAGE ) );
    }
  }

  return new WGSLMainModule( slots, wgsl`
    
    ${options.addScannedReduction ? wgsl`
      var<workgroup> reduction_value: ${binaryOp.type.valueType};
    ` : wgsl``}
    
    var<workgroup> scratch: array<${binaryOp.type.valueType}, ${decimalS( workgroupSize * grainSize )}>;
    
    @compute @workgroup_size(${decimalS( workgroupSize )})
    fn main(
      @builtin(global_invocation_id) global_id: vec3u,
      @builtin(local_invocation_id) local_id: vec3u,
      @builtin(workgroup_id) workgroup_id: vec3u
    ) {
      ${scanComprehensiveWGSL( {
    input: options.inPlace ? wgsl`data` : wgsl`input`,
    output: options.inPlace ? wgsl`data` : wgsl`output`,
    scratch: wgsl`scratch`,
    binaryOp: binaryOp,
    workgroupSize: workgroupSize,
    grainSize: grainSize,
    exclusive: options.exclusive,
    lengthExpression: options.lengthExpression,
    inputOrder: options.inputOrder,
    inputAccessOrder: options.inputAccessOrder,
    factorOutSubexpressions: options.factorOutSubexpressions,
    // TODO: combine these two approaches if possible?
    getAddedValue: options.addScannedReduction ? ( options.addScannedDoubleReduction ? addedValue => wgsl`
          if ( local_id.x == 0u ) {
            // If our reductions are scanned exclusively, then we can just use the value directly
            ${options.areScannedReductionsExclusive ? wgsl`
              let middle_value = scanned_reduction[ workgroup_id.x ];
              let lower_value = double_scanned_reduction[ workgroup_id.x / ${u32S( workgroupSize * grainSize )} ];
            ` : wgsl`
              var middle_value: ${binaryOp.type.valueType};
              var lower_value: ${binaryOp.type.valueType};
              // NOTE: assumes the same workgroup/grain size for each level
              // This should work for any level of workgroup handling
              if ( workgroup_id.x % ${u32S( workgroupSize * grainSize )} == 0u ) {
                middle_value = ${binaryOp.identityWGSL};
              }
              else {
                middle_value = scanned_reduction[ workgroup_id.x - 1u ];
              }
              let lower_index = workgroup_id.x / ${u32S( workgroupSize * grainSize )};
              if ( lower_index % ${u32S( workgroupSize * grainSize )} == 0u ) {
                lower_value = ${binaryOp.identityWGSL};
              }
              else {
                lower_value = double_scanned_reduction[ lower_index - 1u ];
              }
            `}
    
            ${binaryExpressionStatementWGSL( wgsl`reduction_value`, binaryOp.combineExpression || null, binaryOp.combineStatements || null, wgsl`lower_value`, wgsl`middle_value` )}
          }
    
          workgroupBarrier();
    
          ${addedValue} = reduction_value;
        ` : addedValue => wgsl`
          if ( local_id.x == 0u ) {
            // If our reductions are scanned exclusively, then we can just use the value directly
            ${options.areScannedReductionsExclusive ? wgsl`
              reduction_value = scanned_reduction[ workgroup_id.x ];
            ` : wgsl`
              // NOTE: assumes the same workgroup/grain size for each level
              // This should work for any level of workgroup handling
              if ( workgroup_id.x % ${u32S( workgroupSize * grainSize )} == 0u ) {
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
    storeReduction: options.storeReduction ? ( index: WGSLExpressionU32, value: WGSLExpressionT ) => wgsl`reduction[ ${index} ] = ${value};` : null
  } )}
    }
  ` );
};

export default mainScanWGSL;

alpenglow.register( 'mainScanWGSL', mainScanWGSL );