// Copyright 2023-2024, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { combineOptions, optionize3 } from '../../../../../phet-core/js/optionize.js';
import StrictOmit from '../../../../../phet-core/js/types/StrictOmit.js';
import { alpenglow } from '../../../alpenglow.js';
import { BufferSlot } from '../../compute/BufferSlot.js';
import { BinaryOp } from '../../compute/ConcreteType.js';
import { loadReducedWGSL, loadReducedWGSLOptions } from './loadReducedWGSL.js';
import { reduceWGSL, reduceWGSLOptions } from './reduceWGSL.js';
import { RakedSizable } from '../WGSLUtils.js';
import { decimalS, wgsl, WGSLMainModule, WGSLSlot } from '../WGSLString.js';
import { BufferBindingType } from '../../compute/BufferBindingType.js';
import { logStringWGSL } from './logStringWGSL.js';
import { toConvergentIndexWGSL } from './getConvergentIndexWGSL.js';
import { toStripedIndexWGSL } from './toStripedIndexWGSL.js';

export type mainReduceWGSLOptions<T> = {
  input: BufferSlot<T[]>;
  output: BufferSlot<T[]>;

  // TODO: should we really have lengthExpression in loadReducedOptions? Also inputOrder options?!?

  binaryOp: BinaryOp<T>;

  // We can stripe the output (so the next layer of reduce can read it as striped)
  stripeOutput?: boolean;

  // Whether we should remap the data to convergent indices before reducing (i.e. a convergent reduce with non-commutative
  // data.
  convergentRemap?: boolean;

  // e.g. lengthExpression / inputOrder / inputAccessOrder / sequentialReduceStyle
  loadReducedOptions?: StrictOmit<loadReducedWGSLOptions<T>, 'value' | 'binaryOp' | 'loadExpression' | 'loadStatements' | 'workgroupSize' | 'grainSize' | 'globalIndex' | 'workgroupIndex' | 'localIndex'>;

  // e.g. convergent
  reduceOptions?: StrictOmit<reduceWGSLOptions<T>, 'value' | 'scratch' | 'workgroupSize' | 'binaryOp' | 'localIndex' | 'scratchPreloaded' | 'valuePreloaded' | 'mapScratchIndex'>;
} & RakedSizable;

export const MAIN_REDUCE_DEFAULTS = {
  stripeOutput: false,
  convergentRemap: false,
  loadReducedOptions: {},
  reduceOptions: {}
} as const;

export const mainReduceWGSL = <T>(
  providedOptions: mainReduceWGSLOptions<T>
): WGSLMainModule => {

  const options = optionize3<mainReduceWGSLOptions<T>>()( {}, MAIN_REDUCE_DEFAULTS, providedOptions );

  const workgroupSize = options.workgroupSize;
  const grainSize = options.grainSize;
  const binaryOp = options.binaryOp;
  const stripeOutput = options.stripeOutput;
  const convergentRemap = options.convergentRemap;

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
      ${logStringWGSL( `mainReduceWGSL start ${binaryOp.name}` )}
    
      ${loadReducedWGSL( combineOptions<loadReducedWGSLOptions<T>>( {
        value: wgsl`value`,
        binaryOp: binaryOp,
        loadExpression: i => wgsl`input[ ${i} ]`,
        workgroupSize: workgroupSize,
        grainSize: grainSize
      }, options.loadReducedOptions ) )}
    
      ${convergentRemap ? wgsl`
        scratch[ ${toConvergentIndexWGSL( { i: wgsl`local_id.x`, size: workgroupSize } )} ] = value;
    
        workgroupBarrier();
      ` : wgsl``}
    
      ${reduceWGSL( combineOptions<reduceWGSLOptions<T>>( {
        value: wgsl`value`,
        binaryOp: binaryOp,
        scratch: wgsl`scratch`,
        workgroupSize: workgroupSize,
        scratchPreloaded: convergentRemap, // if we convergently reloaded, we don't need to update the scratch
        valuePreloaded: !convergentRemap // if we convergently reloaded, we'll need to load the value from scratch
      }, options.reduceOptions ) )}
    
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

alpenglow.register( 'mainReduceWGSL', mainReduceWGSL );