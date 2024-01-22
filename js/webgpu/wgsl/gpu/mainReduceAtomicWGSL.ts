// Copyright 2023-2024, University of Colorado Boulder

/**
 * Meant for reduction on u32/i32 values (could be generalized to things that can be represented with multiple atomic
 * values, haven't run into that yet).
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BinaryOp, BufferBindingType, BufferSlot, decimalS, loadReducedWGSL, loadReducedWGSLOptions, PipelineBlueprint, RakedSizable, reduceWGSL, reduceWGSLOptions, wgsl, wgslString } from '../../../imports.js';
import { combineOptions, optionize3 } from '../../../../../phet-core/js/optionize.js';
import StrictOmit from '../../../../../phet-core/js/types/StrictOmit.js';

export type mainReduceAtomicWGSLOptions<T> = {
  input: BufferSlot<T[]>;
  output: BufferSlot<T>;

  binaryOp: BinaryOp<T>;

  // e.g. length / inputOrder / inputAccessOrder / sequentialReduceStyle
  loadReducedOptions?: StrictOmit<loadReducedWGSLOptions<T>, 'value' | 'binaryOp' | 'loadExpression' | 'loadStatements' | 'workgroupSize' | 'grainSize' | 'globalIndex' | 'workgroupIndex' | 'localIndex'>;

  reduceOptions?: StrictOmit<reduceWGSLOptions<T>, 'value' | 'scratch' | 'workgroupSize' | 'binaryOp' | 'localIndex' | 'scratchPreloaded' | 'valuePreloaded' | 'mapScratchIndex'>;
} & RakedSizable;

export const MAIN_REDUCE_ATOMIC_DEFAULTS = {
  loadReducedOptions: {
    inputAccessOrder: 'striped'
  },
  reduceOptions: {
    convergent: true
  }
} as const;

const mainReduceAtomicWGSL = <T>(
  blueprint: PipelineBlueprint,
  providedOptions: mainReduceAtomicWGSLOptions<T>
): void => {

  const options = optionize3<mainReduceAtomicWGSLOptions<T>>()( {}, MAIN_REDUCE_ATOMIC_DEFAULTS, providedOptions );

  const workgroupSize = options.workgroupSize;
  const grainSize = options.grainSize;
  const binaryOp = options.binaryOp;

  assert && assert( binaryOp.atomicName );

  blueprint.addSlot( 'input', options.input, BufferBindingType.READ_ONLY_STORAGE );
  blueprint.addSlot( 'output', options.output, BufferBindingType.STORAGE ); // TODO: assert that this is an atomic(!)

  // TODO: generate storage binding and variable fully from Binding?
  blueprint.add( 'main', wgsl`
    
    var<workgroup> scratch: array<${binaryOp.type.valueType}, ${decimalS( workgroupSize )}>;
    
    @compute @workgroup_size(${decimalS( workgroupSize )})
    fn main(
      @builtin(global_invocation_id) global_id: vec3u,
      @builtin(local_invocation_id) local_id: vec3u,
      @builtin(workgroup_id) workgroup_id: vec3u
    ) {
    
      ${loadReducedWGSL( blueprint, combineOptions<loadReducedWGSLOptions<T>>( {
        value: wgsl`value`,
        binaryOp: binaryOp,
        loadExpression: i => wgsl`input[ ${i} ]`,
        workgroupSize: workgroupSize,
        grainSize: grainSize
      }, options.loadReducedOptions ) )}
    
      ${reduceWGSL( blueprint, combineOptions<reduceWGSLOptions<T>>( {
        value: wgsl`value`,
        binaryOp: binaryOp,
        scratch: wgsl`scratch`,
        workgroupSize: workgroupSize
      }, options.reduceOptions ) )}
    
      if ( local_id.x == 0u ) {
        // TODO: better way to handle atomic names
        ${wgslString( binaryOp.atomicName! )}( &output, value );
      }
    }
  ` );
};

export default mainReduceAtomicWGSL;

alpenglow.register( 'mainReduceAtomicWGSL', mainReduceAtomicWGSL );
