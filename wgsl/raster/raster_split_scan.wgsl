// Copyright 2023, University of Colorado Boulder

/**
 * Multiple stream compaction for chunks: distributes the relevant data from the clipped chunks to the reducible and
 * complete chunks, and generates the chunkIndexMap.
 *
 * NOTE: Has similar code to ParallelRasterEdgeScan
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./RasterSplitReduceData
#import ./RasterClippedChunk
#import ./RasterChunk
#import ./RasterCompleteChunk
#import ./RasterStageConfig
#import ./clipped_chunk_info
#import ../utils/inclusive_to_exclusive_scan_indices

#option workgroupSize

@group(0) @binding(0)
var<uniform> config: RasterStageConfig;
@group(0) @binding(1)
var<storage, read> clipped_chunks: array<RasterClippedChunk>;
@group(0) @binding(2)
var<storage, read> split_reduces0: array<RasterSplitReduceData>;
@group(0) @binding(3)
var<storage, read> split_reduces1: array<RasterSplitReduceData>;
@group(0) @binding(4)
var<storage, read> split_reduces2: array<RasterSplitReduceData>;
@group(0) @binding(5)
var<storage, read_write> reducible_chunks: array<RasterChunk>;
@group(0) @binding(6)
var<storage, read_write> complete_chunks: array<RasterCompleteChunk>;
@group(0) @binding(7)
var<storage, read_write> chunk_index_map: array<u32>;
#ifdef debugReduceBuffers
@group(0) @binding(8)
var<storage, read_write> debug_reduces: array<RasterSplitReduceData>;
#endif

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
  let clipped_chunk_index = global_id.x;
  let exists = clipped_chunk_index < config.num_clipped_chunks;

  if ( local_id.x == 0u ) {
    // Convert to an exclusive scan with the different indices
    let indices = inclusive_to_exclusive_scan_indices( clipped_chunk_index, ${u32( workgroupSize )} );

    var baseReducible = 0u;
    var baseComplete = 0u;

    if ( indices.x >= 0i ) {
      let reduce = split_reduces0[ indices.x ];
      baseReducible += reduce.numReducible;
      baseComplete += reduce.numComplete;
    }
    if ( indices.y >= 0i ) {
      let reduce = split_reduces1[ indices.y ];
      baseReducible += reduce.numReducible;
      baseComplete += reduce.numComplete;
    }
    if ( indices.z >= 0i ) {
      // TODO: is this... always guaranteed to be zero for our setup?
      let reduce = split_reduces2[ indices.z ];
      baseReducible += reduce.numReducible;
      baseComplete += reduce.numComplete;
    }

    base_reducible_value = baseReducible;
    base_complete_value = baseComplete;

    // We'll have a barrier before we read this due to the scan, so we don't need to worry much about this
  }

  let clipped_chunk = clipped_chunks[ clipped_chunk_index ];

  var initialValue = RasterSplitReduceData_identity;
  if ( exists ) {
    initialValue = RasterClippedChunk_get_data( clipped_chunk );
  }
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

#ifdef debugReduceBuffers
  debug_reduces[ clipped_chunk_index ] = value;
#endif

  if ( exists ) {
    var baseIndex = 0u; // filled in later

    let is_reducible = ( clipped_chunk.bits & RasterClippedChunk_bits_is_reducible_mask ) != 0u;
    if ( is_reducible ) {

      // Convert to exclusive prefix sum
      baseIndex = base_reducible_value + value.numReducible - initialValue.numReducible;

      chunk_index_map[ clipped_chunk_index ] = baseIndex;

      reducible_chunks[ baseIndex ] = RasterChunk(
        clipped_chunk.bits & RasterChunk_bits_full_mask,
        0u, // filled in by chunk_index_patch
        0u, // filled in by chunk_index_patch
        clipped_chunk.minX, clipped_chunk.minY, clipped_chunk.maxX, clipped_chunk.maxY,
        clipped_chunk.minXCount, clipped_chunk.minYCount, clipped_chunk.maxXCount, clipped_chunk.maxYCount
      );
    }

    let is_complete = ( clipped_chunk.bits & RasterClippedChunk_bits_is_complete_mask ) != 0u;
    if ( is_complete ) {
      // Convert to exclusive prefix sum
      baseIndex = base_complete_value + value.numComplete - initialValue.numComplete;

      chunk_index_map[ clipped_chunk_index ] = baseIndex;

      if ( RasterClippedChunk_needs_complete_output_split( clipped_chunk ) ) {
        // NOTE that count should be the same as... the area?
        let count = RasterClippedChunk_get_output_split_count( clipped_chunk );
        let width = u32( round( clipped_chunk.maxX - clipped_chunk.minX ) ); // rounding as a sanity check

        for ( var i = 0u; i < count; i++ ) {
          let x = clipped_chunk.minX + f32( i % width );
          let y = clipped_chunk.minY + f32( i / width );

          complete_chunks[ baseIndex + i ] = RasterCompleteChunk(
            clipped_chunk.bits & RasterCompleteChunk_bits_full_mask,
            0u, // no edges
            0u, // no edges
            1.0, // area is a full pixel
            x, y, x + 1.0, y + 1.0,
            -1i, 1i, 1i, -1i
          );
        }
      }
      else {
        complete_chunks[ baseIndex ] = RasterCompleteChunk(
          clipped_chunk.bits & RasterCompleteChunk_bits_full_mask,
          0u, // filled in by chunk_index_patch
          0u, // filled in by chunk_index_patch
          clipped_chunk.area,
          clipped_chunk.minX, clipped_chunk.minY, clipped_chunk.maxX, clipped_chunk.maxY,
          clipped_chunk.minXCount, clipped_chunk.minYCount, clipped_chunk.maxXCount, clipped_chunk.maxYCount
        );
      }
    }
  }
}
