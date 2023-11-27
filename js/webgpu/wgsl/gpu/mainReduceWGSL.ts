// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BinaryOp, BindingLocation, loadReducedWGSL, loadReducedWGSLOptions, logStringWGSL, reduceWGSL, reduceWGSLOptions, toConvergentIndexWGSL, toStripedIndexWGSL, WGSLContext, WGSLStatements } from '../../../imports.js';
import { combineOptions, optionize3 } from '../../../../../phet-core/js/optionize.js';
import StrictOmit from '../../../../../phet-core/js/types/StrictOmit.js';

export type mainReduceWGSLOptions<T> = {
  workgroupSize: number;
  grainSize: number;

  bindingLocations: {
    inPlace?: false;
    input: BindingLocation;
    output: BindingLocation;
  } | {
    inPlace: true;
    data: BindingLocation;
  };

  binaryOp: BinaryOp<T>;

  // We can stripe the output (so the next layer of reduce can read it as striped)
  stripeOutput?: boolean;

  // Whether we should remap the data to convergent indices before reducing (i.e. a convergent reduce with non-commutative
  // data.
  convergentRemap?: boolean;

  // e.g. length / inputOrder / inputAccessOrder / sequentialReduceStyle
  loadReducedOptions?: StrictOmit<loadReducedWGSLOptions<T>, 'value' | 'binaryOp' | 'loadExpression' | 'loadStatements' | 'workgroupSize' | 'grainSize' | 'globalIndex' | 'workgroupIndex' | 'localIndex'>;

  // e.g. convergent
  reduceOptions?: StrictOmit<reduceWGSLOptions<T>, 'value' | 'scratch' | 'workgroupSize' | 'binaryOp' | 'localIndex' | 'scratchPreloaded' | 'valuePreloaded' | 'mapScratchIndex'>;
};

const DEFAULT_OPTIONS = {
  stripeOutput: false,
  convergentRemap: false,
  loadReducedOptions: {},
  reduceOptions: {}
} as const;

const mainReduceWGSL = <T>(
  context: WGSLContext,
  providedOptions: mainReduceWGSLOptions<T>
): WGSLStatements => {

  const options = optionize3<mainReduceWGSLOptions<T>>()( {}, DEFAULT_OPTIONS, providedOptions );

  const workgroupSize = options.workgroupSize;
  const grainSize = options.grainSize;
  const binaryOp = options.binaryOp;
  const stripeOutput = options.stripeOutput;
  const convergentRemap = options.convergentRemap;
  const bindingLocations = options.bindingLocations;

  const inputName = bindingLocations.inPlace ? 'data' : 'input';
  const outputName = bindingLocations.inPlace ? 'data' : 'output';

  return `
    
    ${bindingLocations.inPlace ? `
      ${bindingLocations.data.getWGSLAnnotation()}
      var<storage, read_write> data: array<${binaryOp.type.valueType}>;
    ` : `
      ${bindingLocations.input.getWGSLAnnotation()}
      var<storage> input: array<${binaryOp.type.valueType}>;
      
      ${bindingLocations.output.getWGSLAnnotation()}
      var<storage, read_write> output: array<${binaryOp.type.valueType}>;
    `}
    
    var<workgroup> scratch: array<${binaryOp.type.valueType}, ${workgroupSize}>;
    
    @compute @workgroup_size(${workgroupSize})
    fn main(
      @builtin(global_invocation_id) global_id: vec3u,
      @builtin(local_invocation_id) local_id: vec3u,
      @builtin(workgroup_id) workgroup_id: vec3u
    ) {
      ${logStringWGSL( context, `mainReduceWGSL start ${binaryOp.name}` )}
    
      ${loadReducedWGSL( combineOptions<loadReducedWGSLOptions<T>>( {
        value: 'value',
        binaryOp: binaryOp,
        loadExpression: i => `${inputName}[ ${i} ]`,
        workgroupSize: workgroupSize,
        grainSize: grainSize
      }, options.loadReducedOptions ) )}
    
      ${convergentRemap ? `
        scratch[ ${toConvergentIndexWGSL( { i: 'local_id.x', size: workgroupSize } )} ] = value;
    
        workgroupBarrier();
      ` : ''}
    
      ${reduceWGSL( context, combineOptions<reduceWGSLOptions<T>>( {
        value: 'value',
        binaryOp: binaryOp,
        scratch: 'scratch',
        workgroupSize: workgroupSize,
        scratchPreloaded: convergentRemap, // if we convergently reloaded, we don't need to update the scratch
        valuePreloaded: !convergentRemap // if we convergently reloaded, we'll need to load the value from scratch
      }, options.reduceOptions ) )}
    
      if ( local_id.x == 0u ) {
        ${outputName}[ ${stripeOutput ? toStripedIndexWGSL( {
          i: 'workgroup_id.x',
          workgroupSize: workgroupSize,
          grainSize: grainSize
        } ) : 'workgroup_id.x'} ] = value;
      }
    }
  `;
};

export default mainReduceWGSL;

alpenglow.register( 'mainReduceWGSL', mainReduceWGSL );
