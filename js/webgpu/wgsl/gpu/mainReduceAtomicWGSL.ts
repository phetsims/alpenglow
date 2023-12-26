// Copyright 2023, University of Colorado Boulder

/**
 * Meant for reduction on u32/i32 values (could be generalized to things that can be represented with multiple atomic
 * values, haven't run into that yet).
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BinaryOp, BufferBinding, loadReducedWGSL, loadReducedWGSLOptions, RakedSizable, reduceWGSL, reduceWGSLOptions, WGSLContext, WGSLModuleDeclarations } from '../../../imports.js';
import { combineOptions, optionize3 } from '../../../../../phet-core/js/optionize.js';
import StrictOmit from '../../../../../phet-core/js/types/StrictOmit.js';

export type mainReduceAtomicWGSLOptions<T> = {
  binaryOp: BinaryOp<T>;

  bindings: {
    input: BufferBinding<T[]>;
    output: BufferBinding<T>;
  };

  // e.g. length / inputOrder / inputAccessOrder / sequentialReduceStyle
  loadReducedOptions?: StrictOmit<loadReducedWGSLOptions<T>, 'value' | 'lengthExpression' | 'binaryOp' | 'loadExpression' | 'loadStatements' | 'workgroupSize' | 'grainSize' | 'globalIndex' | 'workgroupIndex' | 'localIndex'>;

  reduceOptions?: StrictOmit<reduceWGSLOptions<T>, 'value' | 'scratch' | 'workgroupSize' | 'binaryOp' | 'localIndex' | 'scratchPreloaded' | 'valuePreloaded' | 'mapScratchIndex'>;
} & RakedSizable;

export const MAIN_REDUCE_ATOMIC_DEFAULTS = {
  lengthExpression: null,

  loadReducedOptions: {
    inputAccessOrder: 'striped'
  },
  reduceOptions: {
    convergent: true
  }
} as const;

const mainReduceAtomicWGSL = <T>(
  context: WGSLContext,
  providedOptions: mainReduceAtomicWGSLOptions<T>
): WGSLModuleDeclarations => {

  const options = optionize3<mainReduceAtomicWGSLOptions<T>>()( {}, MAIN_REDUCE_ATOMIC_DEFAULTS, providedOptions );

  const workgroupSize = options.workgroupSize;
  const grainSize = options.grainSize;
  const binaryOp = options.binaryOp;

  assert && assert( binaryOp.atomicName );

  context.addBinding( 'input', options.bindings.input );
  context.addBinding( 'output', options.bindings.output ); // TODO: assert that this is an atomic(!)

  // TODO: generate storage binding and variable fully from Binding?
  return `
    
    var<workgroup> scratch: array<${binaryOp.type.valueType}, ${workgroupSize}>;
    
    @compute @workgroup_size(${workgroupSize})
    fn main(
      @builtin(global_invocation_id) global_id: vec3u,
      @builtin(local_invocation_id) local_id: vec3u,
      @builtin(workgroup_id) workgroup_id: vec3u
    ) {
    
      ${loadReducedWGSL( combineOptions<loadReducedWGSLOptions<T>>( {
        value: 'value',
        binaryOp: binaryOp,
        loadExpression: i => `input[ ${i} ]`,
        workgroupSize: workgroupSize,
        grainSize: grainSize
      }, options.loadReducedOptions ) )}
    
      ${reduceWGSL( context, combineOptions<reduceWGSLOptions<T>>( {
        value: 'value',
        binaryOp: binaryOp,
        scratch: 'scratch',
        workgroupSize: workgroupSize
      }, options.reduceOptions ) )}
    
      if ( local_id.x == 0u ) {
        ${binaryOp.atomicName}( &output, value );
      }
    }
  `;
};

export default mainReduceAtomicWGSL;

alpenglow.register( 'mainReduceAtomicWGSL', mainReduceAtomicWGSL );
