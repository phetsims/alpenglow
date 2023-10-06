// Copyright 2023, University of Colorado Boulder

/**
 * Computes the reducible/complete edge counts for each EdgeClip, and applies the first level of reduction.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./RasterEdgeClip
#import ./RasterClippedChunk
#import ./RasterSplitReduceData
#import ./RasterStageConfig
#import ./clipped_chunk_info

#option workgroupSize

@group(0) @binding(0)
var<uniform> config: RasterStageConfig;
@group(0) @binding(1)
var<storage, read> clipped_chunks: array<RasterClippedChunk>;
@group(0) @binding(2)
var<storage, read> edge_clips: array<RasterEdgeClip>;
@group(0) @binding(3)
var<storage, read_write> edge_reduces: array<RasterSplitReduceData>; // written only
#ifdef debugReduceBuffers
@group(0) @binding(4)
var<storage, read_write> debug_reduces: array<RasterSplitReduceData>;
#endif

var<workgroup> reduces: array<RasterSplitReduceData,${workgroupSize}>;

#bindings

@compute @workgroup_size(${workgroupSize})
fn main(
  @builtin(global_invocation_id) global_id: vec3u,
  @builtin(local_invocation_id) local_id: vec3u,
  @builtin(workgroup_id) workgroup_id: vec3u
) {
  let edge_index = global_id.x;
  let exists = edge_index < config.num_edge_clips;

  let edge_clip = edge_clips[ global_id.x ];
  let clipped_chunk_index = edge_clip.bits & RasterEdgeClip_bits_clipped_chunk_index_mask;
  let clipped_chunk = clipped_chunks[ clipped_chunk_index ];

  var value = RasterSplitReduceData_from( edge_clip, clipped_chunk, exists );

  reduces[ local_id.x ] = value;

#ifdef debugReduceBuffers
  debug_reduces[ global_id.x ] = value;
#endif

  for ( var i = 0u; i < ${u32( Math.log2( workgroupSize ) )}; i++ ) {
    workgroupBarrier();

    let delta = 1u << i;
    if ( local_id.x >= delta ) {
      let other = reduces[ local_id.x - delta ];
      value = RasterSplitReduceData_combine( other, value );
    }

    workgroupBarrier();
    reduces[ local_id.x ] = value;
  }

  if ( local_id.x == ${u32( workgroupSize - 1 )} ) {
    edge_reduces[ workgroup_id.x ] = value;
  }
}
