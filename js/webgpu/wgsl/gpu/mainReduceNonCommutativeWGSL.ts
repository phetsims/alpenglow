// Copyright 2023, University of Colorado Boulder

/**
 * A specialized raked reduce for when our input is non-commutative AND stored in a blocked (not striped) order.
 * We essentially serialize some of it (reading a workgroup-size chunk at a time, reducing it, then loading the next).
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, binaryExpressionStatementWGSL, BinaryOp, BufferBindingType, BufferSlot, OptionalLengthExpressionable, PipelineBlueprint, RakedSizable, reduceWGSL, reduceWGSLOptions, toStripedIndexWGSL, u32, unrollWGSL, WGSLExpression, WGSLVariableName } from '../../../imports.js';
import { combineOptions, optionize3 } from '../../../../../phet-core/js/optionize.js';
import StrictOmit from '../../../../../phet-core/js/types/StrictOmit.js';

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

const mainReduceNonCommutativeWGSL = <T>(
  blueprint: PipelineBlueprint,
  providedOptions: mainReduceNonCommutativeWGSLOptions<T>
): void => {

  const options = optionize3<mainReduceNonCommutativeWGSLOptions<T>>()( {}, MAIN_REDUCE_NON_COMMUTATIVE_DEFAULTS, providedOptions );

  const workgroupSize = options.workgroupSize;
  const grainSize = options.grainSize;
  const binaryOp = options.binaryOp;
  const stripeOutput = options.stripeOutput;
  const lengthExpression = options.lengthExpression;

  blueprint.addSlot( 'input', options.input, BufferBindingType.READ_ONLY_STORAGE );
  blueprint.addSlot( 'output', options.output, BufferBindingType.STORAGE );

  // TODO: generate storage binding and variable fully from Binding?
  blueprint.add( 'main', `
    
    var<workgroup> scratch: array<${binaryOp.type.valueType( blueprint )}, ${workgroupSize}>;

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
      
      ${lengthExpression ? `
        let rn_length = ${lengthExpression};
      ` : ''}
    
      var value: ${binaryOp.type.valueType( blueprint )};
      ${unrollWGSL( 0, grainSize, ( i, isFirst, isLast ) => {
        // TODO: factor out combineToValue handling
        const combineToValue = ( varName: WGSLVariableName, a: WGSLExpression, b: WGSLExpression ) => {
          return binaryExpressionStatementWGSL( varName, binaryOp.combineExpression || null, binaryOp.combineStatements || null, a, b );
        };
    
        return `
          {
            let rn_index = workgroup_id.x * ${u32( workgroupSize * grainSize )} + ${u32( i * workgroupSize )} + local_id.x;
            ${lengthExpression ? `
              value = select( ${binaryOp.identityWGSL}, input[ rn_index ], rn_index < rn_length );
            ` : `
              value = input[ rn_index ];
            `}
            if ( local_id.x == 0u ) {
              ${combineToValue( 'value', 'scratch[ 0u ]', 'value' )}
            }
    
            ${reduceWGSL( blueprint, combineOptions<reduceWGSLOptions<T>>( {
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
  ` );
};

export default mainReduceNonCommutativeWGSL;

alpenglow.register( 'mainReduceNonCommutativeWGSL', mainReduceNonCommutativeWGSL );
