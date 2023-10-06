// Copyright 2023, University of Colorado Boulder

/**
 * We continue the segmented reduction started in ParallelRasterInitialClip, also applying things to RasterClippedChunks,
 * however we need to track the "left" and "right" values separately.
 *
 * See docs on RasterChunkReduceQuad for the need for "left"/"right"
 *
 * NOTE: The reduction is also completed in ParallelRasterInitialClip, so if changing this file, please check there too
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./RasterClippedChunk
#import ./RasterChunkReduceQuad
#import ./RasterStageConfig
#import ./apply_to_clipped_chunk

#option workgroupSize

@group(0) @binding(0)
var<uniform> config: RasterStageConfig;
@group(0) @binding(1)
var<uniform> reduce_number: vec4u; // Has the 16 bytes desired, x will hold the reduce number
@group(0) @binding(2)
var<storage, read> input_chunk_reduces: array<RasterChunkReduceQuad>;
@group(0) @binding(3)
var<storage, read_write> clipped_chunks: array<RasterClippedChunk>; // mutated
@group(0) @binding(4)
var<storage, read_write> output_chunk_reduces: array<RasterChunkReduceQuad>; // written only

var<workgroup> reduces: array<RasterChunkReduceQuad,${workgroupSize}>;

var<workgroup> first_clipped_chunk_index: u32;

var<workgroup> max_first_reduce_index: atomic<u32>;

#bindings

// TODO: actually, we'll probably eventually create a custom one that doesn't take an output buffer for the last one?
@compute @workgroup_size(${workgroupSize})
fn main(
  @builtin(global_invocation_id) global_id: vec3u,
  @builtin(local_invocation_id) local_id: vec3u,
  @builtin(workgroup_id) workgroup_id: vec3u
) {
  // NOTE: We're taking the direct number of workgroups from the uniform from the last stage.
  let num_reduces = select( config.chunk_reduce_0_workgroup_x, config.initial_clip_workgroup_x, reduce_number.x == 0u );
  let reduce_index = global_id.x;
  let exists = reduce_index < num_reduces;

  var value = RasterChunkReduceQuad_out_of_range;
  if ( exists ) {
    value = input_chunk_reduces[ reduce_index ];
  }

  // Get the "left" index
  let clipped_chunk_index = value.leftMin.bits & RasterChunkReduceData_bits_clipped_chunk_index_mask;

  // We'll workgroupBarrier at least once below, before this is relevant
  if ( exists && local_id.x == 0u ) {
    first_clipped_chunk_index = clipped_chunk_index;
  }

  reduces[ local_id.x ] = value;

  // We need to not double-apply. So we'll only apply when merging into this specific index, since it will
  // (a) be the first combination with the joint "both" result, and (b) it's the simplest to filter for.
  // Note: -5 is different than the "out of range" RasterChunkReduceData value
  // NOTE: we use the bitwise trick to check value.leftMin.isLastEdge() && !value.leftMin.isFirstEdge()
  let applicableMinChunkIndex = select(
    0xffffffff, // unavailable clipped chunk index, should not equal anything
    value.leftMin.bits & RasterChunkReduceData_bits_clipped_chunk_index_mask,
    exists && ( ( value.leftMin.bits & RasterChunkReduceData_bits_first_last_mask ) == RasterChunkReduceData_bits_is_last_edge_mask )
  );

  for ( var i = 0u; i < ${u32( Math.log2( workgroupSize ) )}; i++ ) {
    workgroupBarrier();

    let delta = 1u << i;
    if ( local_id.x >= delta ) {
      let otherValue = reduces[ local_id.x - delta ];
      let oldValue = value;

      value = RasterChunkReduceQuad_combine( otherValue, value );

      // NOTE: The similar "max" condition would be identical. It would be
      // |     applicableMaxChunkIndex == otherValue.rightMax.clippedChunkIndex && otherValue.rightMax.isFirstEdge
      // We effectively only need to check and store one of these, since the min/max indices will be essentially
      // just offset by one
      if (
        // TODO: the mask length is killing readability, can we... macro-inline functions perhaps?
        // TODO: yes, preprocessor macros might be helpful (or just, inlining functions)
        applicableMinChunkIndex == ( otherValue.rightMin.bits & RasterChunkReduceData_bits_clipped_chunk_index_mask ) &&
        // TODO: check to see if the discrepancy here between otherValue-right and the value in initial-clip is a bug
        ( otherValue.rightMin.bits & RasterChunkReduceData_bits_is_first_edge_mask ) != 0u
      ) {
        // "middle" reduces
        apply_to_clipped_chunk( RasterChunkReduceData_combine( otherValue.rightMin, oldValue.leftMin ) );
        apply_to_clipped_chunk( RasterChunkReduceData_combine( otherValue.rightMax, oldValue.leftMax ) );
      }
    }

    workgroupBarrier();
    reduces[ local_id.x ] = value;
  }

  // Atomically compute the max(localId.x) that has the same clippedChunkIndex as localId.x==0.
  if ( exists && clipped_chunk_index == first_clipped_chunk_index ) {
    atomicMax( &max_first_reduce_index, local_id.x );
  }
  workgroupBarrier(); // for the atomic

  // Store our reduction result
  if ( exists && local_id.x == 0 ) {
    let last_local_index_in_workgroup = min(
      num_reduces - 1u - workgroup_id.x * ${u32( workgroupSize )},
      ${u32( workgroupSize - 1 )}
    );

    let leftValue = reduces[ atomicLoad( &max_first_reduce_index ) ];
    let rightValue = reduces[ last_local_index_in_workgroup ];

    output_chunk_reduces[ workgroup_id.x ] = RasterChunkReduceQuad(
      leftValue.leftMin,
      leftValue.leftMax,
      rightValue.rightMin,
      rightValue.rightMax
    );
  }
}
