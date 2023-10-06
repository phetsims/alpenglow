// Copyright 2023, University of Colorado Boulder

/**
 * Updates the reducible/complete chunks with proper destination edge indices (so the chunk references the range of
 * edges it is comprised of).
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./RasterStageConfig
#import ./RasterClippedChunk
#import ./RasterChunk
#import ./RasterCompleteChunk

#option workgroupSize

@group(0) @binding(0)
var<uniform> config: RasterStageConfig;
@group(0) @binding(1)
var<storage, read> chunk_index_map: array<u32>;
@group(0) @binding(2)
var<storage, read> chunk_indices: array<u32>;
@group(0) @binding(3)
var<storage, read> clipped_chunks: array<RasterClippedChunk>;
@group(0) @binding(4)
var<storage, read_write> reducible_chunks: array<RasterChunk>;
@group(0) @binding(5)
var<storage, read_write> complete_chunks: array<RasterCompleteChunk>;

#bindings

@compute @workgroup_size(${workgroupSize})
fn main(
  @builtin(global_invocation_id) global_id: vec3u,
  @builtin(local_invocation_id) local_id: vec3u,
  @builtin(workgroup_id) workgroup_id: vec3u
) {
  let clipped_chunk_index = global_id.x;
  let exists = clipped_chunk_index < config.num_clipped_chunks;

  if ( exists ) {
    let clipped_chunk = clipped_chunks[ clipped_chunk_index ];
    let output_chunk_index = chunk_index_map[ clipped_chunk_index ];

    let startIndex = chunk_indices[ 2u * clipped_chunk_index ];
    let endIndex = chunk_indices[ 2u * clipped_chunk_index + 1u ];

    let is_reducible = ( clipped_chunk.bits & RasterClippedChunk_bits_is_reducible_mask ) != 0u;
    if ( is_reducible ) {
      let chunk = reducible_chunks[ output_chunk_index ];
      reducible_chunks[ output_chunk_index ] = RasterChunk(
        chunk.bits,
        startIndex,
        endIndex - startIndex,
        chunk.minX, chunk.minY, chunk.maxX, chunk.maxY,
        chunk.minXCount, chunk.minYCount, chunk.maxXCount, chunk.maxYCount
      );
    }

    let is_complete = ( clipped_chunk.bits & RasterClippedChunk_bits_is_complete_mask ) != 0u;
    if ( is_complete ) {
      let chunk = complete_chunks[ output_chunk_index ];
      let needs_face = ( clipped_chunk.bits & RasterClippedChunk_bits_needs_face_mask ) != 0u;
      let is_full_area = ( chunk.bits & RasterCompleteChunk_bits_is_full_area_mask ) != 0u;
      complete_chunks[ output_chunk_index ] = RasterCompleteChunk(
        chunk.bits,
        select( 0u, startIndex, needs_face && !is_full_area ),
        select( 0u, endIndex - startIndex, needs_face && !is_full_area ),
        chunk.area,
        chunk.minX, chunk.minY, chunk.maxX, chunk.maxY,
        chunk.minXCount, chunk.minYCount, chunk.maxXCount, chunk.maxYCount
      );
    }
  }
}
