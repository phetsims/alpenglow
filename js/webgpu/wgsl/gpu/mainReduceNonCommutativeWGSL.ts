// Copyright 2023, University of Colorado Boulder

/**
 * A specialized raked reduce for when our input is non-commutative AND stored in a blocked (not striped) order.
 * We essentially serialize some of it (reading a workgroup-size chunk at a time, reducing it, then loading the next).
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, binaryExpressionStatementWGSL, BinaryOp, Binding, RakedSizable, reduceWGSL, reduceWGSLOptions, toStripedIndexWGSL, u32, unrollWGSL, WGSLContext, WGSLExpression, WGSLModuleDeclarations, WGSLVariableName } from '../../../imports.js';
import { combineOptions, optionize3 } from '../../../../../phet-core/js/optionize.js';
import StrictOmit from '../../../../../phet-core/js/types/StrictOmit.js';

export type mainReduceNonCommutativeWGSLOptions<T> = {
  bindings: {
    input: Binding;
    output: Binding;
  };

  // TODO: length handling?!?

  binaryOp: BinaryOp<T>;

  // We can stripe the output (so the next layer of reduce can read it as striped)
  stripeOutput?: boolean;

  // e.g. something in the future?
  reduceOptions?: StrictOmit<reduceWGSLOptions<T>, 'value' | 'scratch' | 'workgroupSize' | 'binaryOp' | 'localIndex' | 'scratchPreloaded' | 'valuePreloaded' | 'mapScratchIndex' | 'convergent'>;
} & RakedSizable;

export const MAIN_REDUCE_NON_COMMUTATIVE_DEFAULTS = {
  stripeOutput: false,
  reduceOptions: {}
} as const;

const mainReduceNonCommutativeWGSL = <T>(
  context: WGSLContext,
  providedOptions: mainReduceNonCommutativeWGSLOptions<T>
): WGSLModuleDeclarations => {

  const options = optionize3<mainReduceNonCommutativeWGSLOptions<T>>()( {}, MAIN_REDUCE_NON_COMMUTATIVE_DEFAULTS, providedOptions );

  const workgroupSize = options.workgroupSize;
  const grainSize = options.grainSize;
  const binaryOp = options.binaryOp;
  const stripeOutput = options.stripeOutput;

  // TODO: generate storage binding and variable fully from Binding?
  return `
    
    ${options.bindings.input.location.getWGSLAnnotation()}
    var<storage, ${options.bindings.input.getStorageAccess()}> input: array<${binaryOp.type.valueType}>;
    
    ${options.bindings.output.location.getWGSLAnnotation()}
    var<storage, ${options.bindings.output.getStorageAccess()}> output: array<${binaryOp.type.valueType}>;
    
    var<workgroup> scratch: array<${binaryOp.type.valueType}, ${workgroupSize}>;

    @compute @workgroup_size(${workgroupSize})
    fn main(
      @builtin(global_invocation_id) global_id: vec3u,
      @builtin(local_invocation_id) local_id: vec3u,
      @builtin(workgroup_id) workgroup_id: vec3u
    ) {
      // TODO: we can probably accomplish this with smarter use of the local variables
      if ( local_id.x == 0u ) {
        scratch[ 0u ] = ${binaryOp.identityWGSL};
      }
    
      var value: ${binaryOp.type.valueType};
      ${unrollWGSL( 0, grainSize, ( i, isFirst, isLast ) => {
        // TODO: factor out combineToValue handling
        const combineToValue = ( varName: WGSLVariableName, a: WGSLExpression, b: WGSLExpression ) => {
          return binaryExpressionStatementWGSL( varName, binaryOp.combineExpression || null, binaryOp.combineStatements || null, a, b );
        };
    
        return `
          {
            value = input[ workgroup_id.x * ${u32( workgroupSize * grainSize )} + ${u32( i * workgroupSize )} + local_id.x ];
            if ( local_id.x == 0u ) {
              ${combineToValue( 'value', 'scratch[ 0u ]', 'value' )}
            }
    
            ${reduceWGSL( context, combineOptions<reduceWGSLOptions<T>>( {
              value: 'value',
              scratch: 'scratch',
              binaryOp: binaryOp,
              workgroupSize: workgroupSize
            }, options.reduceOptions ) )}
    
            ${!isLast ? `
              if ( local_id.x == 0u ) {
                scratch[ 0u ] = value;
              }
            ` : ''}
          }
        `;
      } )}
    
      if ( local_id.x == 0u ) {
        output[ ${stripeOutput ? toStripedIndexWGSL( {
          i: 'workgroup_id.x',
          workgroupSize: workgroupSize,
          grainSize: grainSize
        } ) : 'workgroup_id.x'} ] = value;
      }
    }

  `;
};

export default mainReduceNonCommutativeWGSL;

alpenglow.register( 'mainReduceNonCommutativeWGSL', mainReduceNonCommutativeWGSL );
