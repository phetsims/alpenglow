// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BinaryOp, loadReducedWGSL, reduceWGSL, toConvergentIndexWGSL, toStripedIndexWGSL, WGSLExpressionU32, WGSLStatements } from '../../../imports.js';
import { optionize3 } from '../../../../../phet-core/js/optionize.js';

export type mainReduceWGSLOptions<T> = {
  workgroupSize: number;
  grainSize: number;

  binaryOp: BinaryOp<T>;

  // Whether we should reduce in a convergent order. This will reduce control divergence when running, and will
  // potentially allow warps to exit early. This should result in a speed-up, but the data either needs to have a
  // commutative combine operation, OR the order should be in a "convergent" order. That would mean that for each data
  // chunk read by each workgroup, the indices are bit-reversed (e.g. if we have a workgroup size of 256, then we are
  // reversing the last 8 bits of the index, thus the first element should be stored at index 0, the second element at
  // index 128, the third element at index 64, etc.). See get_convergent_index for more information.
  // For instance, the order of reduction of the first 16 hex digits (in a convergent order) would be
  // 084c2a6e195d3b7f.
  convergent?: boolean;

  // if provided, it will enable range checks (based on the inputOrder)
  length?: WGSLExpressionU32 | null;

  // The actual order of the data in memory (needed for range checks, not required if range checks are disabled)
  inputOrder?: 'blocked' | 'striped';

  // The order of access to the input data (determines the "value" output order also)
  inputAccessOrder?: 'blocked' | 'striped'; // NOTE: Not just striped, if we're using this somehow and mapping indices ourselves

  // Whether local variables should be used to factor out subexpressions (potentially more register usage, but less
  // computation), or also whether to nest the combine calls, e.g. combine( combine( combine( a, b ), c ), d )
  sequentialReduceStyle?: 'factored' | 'unfactored' | 'nested';

  // TODO: grab options from other types we use, so they propagate

  // We can stripe the output (so the next layer of reduce can read it as striped)
  stripeOutput?: boolean;

  // Whether we should remap the data to convergent indices before reducing (i.e. a convergent reduce with non-commutative
  // data.
  convergentRemap?: boolean;
};

const DEFAULT_OPTIONS = {
  convergent: false,
  stripeOutput: false,
  convergentRemap: false,
  length: null,
  inputOrder: 'blocked',
  inputAccessOrder: 'striped',
  sequentialReduceStyle: 'factored'
} as const;

const mainReduceWGSL = <T>(
  providedOptions: mainReduceWGSLOptions<T>
): WGSLStatements => {

  const options = optionize3<mainReduceWGSLOptions<T>>()( {}, DEFAULT_OPTIONS, providedOptions );

  const workgroupSize = options.workgroupSize;
  const grainSize = options.grainSize;
  const binaryOp = options.binaryOp;
  const convergent = options.convergent;
  const length = options.length;
  const inputOrder = options.inputOrder;
  const inputAccessOrder = options.inputAccessOrder;
  const sequentialReduceStyle = options.sequentialReduceStyle;
  const stripeOutput = options.stripeOutput;
  const convergentRemap = options.convergentRemap;

  assert && assert( binaryOp.isCommutative || inputOrder === inputAccessOrder );

  return `
    
    @group(0) @binding(0)
    var<storage> input: array<${binaryOp.type.valueType}>;
    @group(0) @binding(1)
    var<storage, read_write> output: array<${binaryOp.type.valueType}>;
    
    var<workgroup> scratch: array<${binaryOp.type.valueType}, ${workgroupSize}>;
    
    @compute @workgroup_size(${workgroupSize})
    fn main(
      @builtin(global_invocation_id) global_id: vec3u,
      @builtin(local_invocation_id) local_id: vec3u,
      @builtin(workgroup_id) workgroup_id: vec3u
    ) {
      ${loadReducedWGSL( {
        value: 'value',
        binaryOp: binaryOp,
        loadExpression: i => `input[ ${i} ]`,
        workgroupSize: workgroupSize,
        grainSize: grainSize,
        length: length,
        inputOrder: inputOrder,
        inputAccessOrder: inputAccessOrder,
        sequentialReduceStyle: sequentialReduceStyle
      } )}
    
      ${convergentRemap ? `
        scratch[ ${toConvergentIndexWGSL( { i: 'local_id.x', size: workgroupSize } )} ] = value;
    
        workgroupBarrier();
      ` : ''}
    
      // TODO: good way of combining the valueType/identity/combine*?
      ${reduceWGSL( {
        value: 'value',
        binaryOp: binaryOp,
        scratch: 'scratch',
        workgroupSize: workgroupSize,
        convergent: convergent,
        scratchPreloaded: convergentRemap, // if we convergently reloaded, we don't need to update the scratch
        valuePreloaded: !convergentRemap // if we convergently reloaded, we'll need to load the value from scratch
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

export default mainReduceWGSL;

alpenglow.register( 'mainReduceWGSL', mainReduceWGSL );
