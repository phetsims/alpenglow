// Copyright 2023, University of Colorado Boulder

/**
 * Multiple stream compaction: distributes the relevant data from the RasterEdgeClips into the reducible (RasterEdge)
 * and complete (RasterCompleteEdge) locations, and generates the needed chunkIndices array as a byproduct.
 *
 * NOTE: Has similar code to ParallelRasterSplitScan
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./RasterClippedChunk
#import ./RasterEdgeClip
#import ./RasterSplitReduceData
#import ./RasterEdge
#import ./RasterCompleteEdge
#import ./RasterStageConfig
#import ./clipped_chunk_info
#import ../utils/inclusive_to_exclusive_scan_indices

#option workgroupSize

@group(0) @binding(0)
var<uniform> config: RasterStageConfig;
@group(0) @binding(1)
var<storage, read> clipped_chunks: array<RasterClippedChunk>;
@group(0) @binding(2)
var<storage, read> edge_clips: array<RasterEdgeClip>;
@group(0) @binding(3)
var<storage, read> edge_reduces0: array<RasterSplitReduceData>;
@group(0) @binding(4)
var<storage, read> edge_reduces1: array<RasterSplitReduceData>;
@group(0) @binding(5)
var<storage, read> edge_reduces2: array<RasterSplitReduceData>;
@group(0) @binding(6)
var<storage, read_write> reducible_edges: array<RasterEdge>;
@group(0) @binding(7)
var<storage, read_write> complete_edges: array<RasterCompleteEdge>;
@group(0) @binding(8)
var<storage, read_write> chunk_indices: array<u32>;
// TODO: we seem to be at the limit of the number of default storage bindings possible?

var<workgroup> reduces: array<RasterSplitReduceData,${workgroupSize}>;
var<workgroup> base_reducible_value: u32;
var<workgroup> base_complete_value: u32;

#bindings

@compute @workgroup_size(${workgroupSize})
fn main(
  @builtin(global_invocation_id) global_id: vec3u,
  @builtin(local_invocation_id) local_id: vec3u,
  @builtin(workgroup_id) workgroup_id: vec3u
) {
  let edge_clip_index = global_id.x;
  let exists = edge_clip_index < config.num_edge_clips;
  if ( local_id.x == 0u ) {
    // Convert to an exclusive scan with the different indices
    let indices = inclusive_to_exclusive_scan_indices( edge_clip_index, ${u32( workgroupSize )} );

    var baseReducible = 0u;
    var baseComplete = 0u;

    if ( indices.x >= 0i ) {
      let reduce = edge_reduces0[ indices.x ];
      baseReducible += reduce.numReducible;
      baseComplete += reduce.numComplete;
    }
    if ( indices.y >= 0i ) {
      let reduce = edge_reduces1[ indices.y ];
      baseReducible += reduce.numReducible;
      baseComplete += reduce.numComplete;
    }
    if ( indices.z >= 0i ) {
      // TODO: is this... always guaranteed to be zero for our setup?
      let reduce = edge_reduces2[ indices.z ];
      baseReducible += reduce.numReducible;
      baseComplete += reduce.numComplete;
    }

    base_reducible_value = baseReducible;
    base_complete_value = baseComplete;

    // We'll have a barrier before we read this due to the scan, so we don't need to worry much about this
  }

  let edge_clip = edge_clips[ global_id.x ];
  let clipped_chunk_index = edge_clip.bits & RasterEdgeClip_bits_clipped_chunk_index_mask;
  let clipped_chunk = clipped_chunks[ clipped_chunk_index ];

  let initialValue = RasterSplitReduceData_from( edge_clip, clipped_chunk, exists );
  var value = initialValue;

  reduces[ local_id.x ] = value;

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

  if ( exists ) {
    // TODO: here is where we would add a debugEdgeScan:
//    await debugEdgeScan.set( context, global_id.x, RasterSplitReduceData(
//      base_reducible_value + value.numReducible - initialValue.numReducible,
//      base_complete_value + value.numComplete - initialValue.numComplete
//    ) );

    var edgeStarts: array<vec2f,3>;
    var edgeEnds: array<vec2f,3>;

    var index = 0u;
    if ( edge_clip.p0x != edge_clip.p1x || edge_clip.p0y != edge_clip.p1y ) {
      edgeStarts[ index ] = vec2( edge_clip.p0x, edge_clip.p0y );
      edgeEnds[ index ] = vec2( edge_clip.p1x, edge_clip.p1y );
      index++;
    }
    if ( edge_clip.p1x != edge_clip.p2x || edge_clip.p1y != edge_clip.p2y ) {
      edgeStarts[ index ] = vec2( edge_clip.p1x, edge_clip.p1y );
      edgeEnds[ index ] = vec2( edge_clip.p2x, edge_clip.p2y );
      index++;
    }
    if ( edge_clip.p2x != edge_clip.p3x || edge_clip.p2y != edge_clip.p3y ) {
      edgeStarts[ index ] = vec2( edge_clip.p2x, edge_clip.p2y );
      edgeEnds[ index ] = vec2( edge_clip.p3x, edge_clip.p3y );
      index++;
    }

    let has_reducible_vertices = ( clipped_chunk.bits & RasterClippedChunk_bits_is_reducible_mask ) != 0u;
    let has_complete_vertices = RasterClippedChunk_is_exporting_complete_edges( clipped_chunk );
    var base_index = 0u; // filled in later

    if ( has_reducible_vertices ) {
      // Convert to exclusive prefix sum
      base_index = base_reducible_value + value.numReducible - initialValue.numReducible;

      // NOTE: the first/last values will get filled in later
      if ( index > 0u ) {
        reducible_edges[ base_index ] = RasterEdge(
          clipped_chunk_index,

          // TODO: vec2fs if alignment change works?
          edgeStarts[ 0u ].x,
          edgeStarts[ 0u ].y,
          edgeEnds[ 0u ].x,
          edgeEnds[ 0u ].y
        );
        if ( index > 1 ) {
          reducible_edges[ base_index + 1u ] = RasterEdge(
            clipped_chunk_index,
            edgeStarts[ 1u ].x,
            edgeStarts[ 1u ].y,
            edgeEnds[ 1u ].x,
            edgeEnds[ 1u ].y
          );
          if ( index > 2 ) {
            reducible_edges[ base_index + 2u ] = RasterEdge(
              clipped_chunk_index,
              edgeStarts[ 2u ].x,
              edgeStarts[ 2u ].y,
              edgeEnds[ 2u ].x,
              edgeEnds[ 2u ].y
            );
          }
        }
      }
    }

    // TODO: consider logic restructuring to combine the above and this into one
    if ( has_complete_vertices ) {
      // Convert to exclusive prefix sum
      base_index = base_complete_value + value.numComplete - initialValue.numComplete;

      if ( index > 0u ) {
        complete_edges[ base_index ] = RasterCompleteEdge(
          edgeStarts[ 0u ].x,
          edgeStarts[ 0u ].y,
          edgeEnds[ 0u ].x,
          edgeEnds[ 0u ].y
        );
        if ( index > 1 ) {
          complete_edges[ base_index + 1u ] = RasterCompleteEdge(
            edgeStarts[ 1u ].x,
            edgeStarts[ 1u ].y,
            edgeEnds[ 1u ].x,
            edgeEnds[ 1u ].y
          );
          if ( index > 2 ) {
            complete_edges[ base_index + 2u ] = RasterCompleteEdge(
              edgeStarts[ 2u ].x,
              edgeStarts[ 2u ].y,
              edgeEnds[ 2u ].x,
              edgeEnds[ 2u ].y
            );
          }
        }
      }
    }

    // chunk indices
    // NOTE: Can't just output the end of each, since we are splitting them across reducible/completed
    if ( has_reducible_vertices || has_complete_vertices ) {
      let is_first_edge = ( edge_clip.bits & RasterEdgeClip_bits_is_first_edge_mask ) != 0u;
      if ( is_first_edge ) {
        chunk_indices[ 2u * clipped_chunk_index ] = base_index;
      }

      let is_last_edge = ( edge_clip.bits & RasterEdgeClip_bits_is_last_edge_mask ) != 0u;
      if ( is_last_edge ) {
        chunk_indices[ 2u * clipped_chunk_index + 1u ] = base_index + index;
      }
    }
  }
}
