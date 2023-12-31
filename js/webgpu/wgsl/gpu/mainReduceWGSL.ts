// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BinaryOp, BufferBindingType, BufferSlot, loadReducedWGSL, loadReducedWGSLOptions, logStringWGSL, PipelineBlueprint, RakedSizable, reduceWGSL, reduceWGSLOptions, toConvergentIndexWGSL, toStripedIndexWGSL } from '../../../imports.js';
import { combineOptions, optionize3 } from '../../../../../phet-core/js/optionize.js';
import StrictOmit from '../../../../../phet-core/js/types/StrictOmit.js';

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

const mainReduceWGSL = <T>(
  blueprint: PipelineBlueprint,
  providedOptions: mainReduceWGSLOptions<T>
): void => {

  const options = optionize3<mainReduceWGSLOptions<T>>()( {}, MAIN_REDUCE_DEFAULTS, providedOptions );

  const workgroupSize = options.workgroupSize;
  const grainSize = options.grainSize;
  const binaryOp = options.binaryOp;
  const stripeOutput = options.stripeOutput;
  const convergentRemap = options.convergentRemap;

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
      ${logStringWGSL( blueprint, `mainReduceWGSL start ${binaryOp.name}` )}
    
      ${loadReducedWGSL( blueprint, combineOptions<loadReducedWGSLOptions<T>>( {
        value: 'value',
        binaryOp: binaryOp,
        loadExpression: i => `input[ ${i} ]`,
        workgroupSize: workgroupSize,
        grainSize: grainSize
      }, options.loadReducedOptions ) )}
    
      ${convergentRemap ? `
        scratch[ ${toConvergentIndexWGSL( { i: 'local_id.x', size: workgroupSize } )} ] = value;
    
        workgroupBarrier();
      ` : ''}
    
      ${reduceWGSL( blueprint, combineOptions<reduceWGSLOptions<T>>( {
        value: 'value',
        binaryOp: binaryOp,
        scratch: 'scratch',
        workgroupSize: workgroupSize,
        scratchPreloaded: convergentRemap, // if we convergently reloaded, we don't need to update the scratch
        valuePreloaded: !convergentRemap // if we convergently reloaded, we'll need to load the value from scratch
      }, options.reduceOptions ) )}
    
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

export default mainReduceWGSL;

alpenglow.register( 'mainReduceWGSL', mainReduceWGSL );
