// Copyright 2023-2025, University of Colorado Boulder

/**
 * A specialized raked reduce for when our input is non-commutative AND stored in a blocked (not striped) order.
 * We essentially serialize some of it (reading a workgroup-size chunk at a time, reducing it, then loading the next).
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { combineOptions, optionize3 } from '../../../../../phet-core/js/optionize.js';
import StrictOmit from '../../../../../phet-core/js/types/StrictOmit.js';
import { alpenglow } from '../../../alpenglow.js';
import { BufferSlot } from '../../compute/BufferSlot.js';
import { BinaryOp } from '../../compute/ConcreteType.js';
import { reduceWGSL, reduceWGSLOptions } from './reduceWGSL.js';
import { OptionalLengthExpressionable, RakedSizable } from '../WGSLUtils.js';
import { decimalS, u32S, wgsl, WGSLExpression, WGSLMainModule, WGSLSlot, WGSLVariableName } from '../WGSLString.js';
import { BufferBindingType } from '../../compute/BufferBindingType.js';
import { unrollWGSL } from './unrollWGSL.js';
import { binaryExpressionStatementWGSL } from './binaryExpressionStatementWGSL.js';
import { toStripedIndexWGSL } from './toStripedIndexWGSL.js';

export type mainReduceNonCommutativeWGSLOptions<T> = {
  input: BufferSlot<T[]>;
  output: BufferSlot<T[]>;

  // TODO: length handling?!?

  binaryOp: BinaryOp<T>;

  // We can stripe the output (so the next layer of reduce can read it as striped)
  stripeOutput?: boolean;

  // e.g. something in the future?
  reduceOptions?: StrictOmit<reduceWGSLOptions<T>, 'value' | 'scratch' | 'workgroupSize' | 'binaryOp' | 'localIndex' | 'scratchPreloaded' | 'valuePreloaded' | 'mapScratchIndex' | 'convergent'>;
} & RakedSizable & OptionalLengthExpressionable;

export const MAIN_REDUCE_NON_COMMUTATIVE_DEFAULTS = {
  lengthExpression: null,
  stripeOutput: false,
  reduceOptions: {}
} as const;

export const mainReduceNonCommutativeWGSL = <T>(
  providedOptions: mainReduceNonCommutativeWGSLOptions<T>
): WGSLMainModule => {

  const options = optionize3<mainReduceNonCommutativeWGSLOptions<T>>()( {}, MAIN_REDUCE_NON_COMMUTATIVE_DEFAULTS, providedOptions );

  const workgroupSize = options.workgroupSize;
  const grainSize = options.grainSize;
  const binaryOp = options.binaryOp;
  const stripeOutput = options.stripeOutput;
  const lengthExpression = options.lengthExpression;

  return new WGSLMainModule( [
    new WGSLSlot( 'input', options.input, BufferBindingType.READ_ONLY_STORAGE ),
    new WGSLSlot( 'output', options.output, BufferBindingType.STORAGE )
  ], wgsl`
    
    var<workgroup> scratch: array<${binaryOp.type.valueType}, ${decimalS( workgroupSize )}>;

    @compute @workgroup_size(${decimalS( workgroupSize )})
    fn main(
      @builtin(global_invocation_id) global_id: vec3u,
      @builtin(local_invocation_id) local_id: vec3u,
      @builtin(workgroup_id) workgroup_id: vec3u
    ) {
      // TODO: we can probably accomplish this with smarter use of the local variables
      if ( local_id.x == 0u ) {
        scratch[ 0u ] = ${binaryOp.identityWGSL};
      }
      
      ${lengthExpression ? wgsl`
        let rn_length = ${lengthExpression};
      ` : wgsl``}
    
      var value: ${binaryOp.type.valueType};
      ${unrollWGSL( 0, grainSize, ( i, isFirst, isLast ) => {
        // TODO: factor out combineToValue handling
        const combineToValue = ( varName: WGSLVariableName, a: WGSLExpression, b: WGSLExpression ) => {
          return binaryExpressionStatementWGSL( varName, binaryOp.combineExpression || null, binaryOp.combineStatements || null, a, b );
        };
    
        return wgsl`
          {
            let rn_index = workgroup_id.x * ${u32S( workgroupSize * grainSize )} + ${u32S( i * workgroupSize )} + local_id.x;
            ${lengthExpression ? wgsl`
              value = select( ${binaryOp.identityWGSL}, input[ rn_index ], rn_index < rn_length );
            ` : wgsl`
              value = input[ rn_index ];
            `}
            if ( local_id.x == 0u ) {
              ${combineToValue( wgsl`value`, wgsl`scratch[ 0u ]`, wgsl`value` )}
            }
    
            ${reduceWGSL( combineOptions<reduceWGSLOptions<T>>( {
              value: wgsl`value`,
              scratch: wgsl`scratch`,
              binaryOp: binaryOp,
              workgroupSize: workgroupSize
            }, options.reduceOptions ) )}
    
            ${!isLast ? wgsl`
              if ( local_id.x == 0u ) {
                scratch[ 0u ] = value;
              }
            ` : wgsl``}
          }
        `;
      } )}
    
      if ( local_id.x == 0u ) {
        output[ ${stripeOutput ? toStripedIndexWGSL( {
          i: wgsl`workgroup_id.x`,
          workgroupSize: workgroupSize,
          grainSize: grainSize
        } ) : wgsl`workgroup_id.x`} ] = value;
      }
    }
  ` );
};

alpenglow.register( 'mainReduceNonCommutativeWGSL', mainReduceNonCommutativeWGSL );