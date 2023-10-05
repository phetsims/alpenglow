// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./RasterChunk
#import ./RasterClippedChunk
#import ./RasterStageConfig

#option workgroupSize

@group(0) @binding(0)
var<uniform> config: RasterStageConfig;
@group(0) @binding(1)
var<storage, read> input_chunks: array<RasterChunk>;
@group(0) @binding(2)
var<storage, read_write> clipped_chunks: array<RasterClippedChunk>;

#bindings

@compute @workgroup_size(${workgroupSize})
fn main(
  @builtin(global_invocation_id) global_id: vec3u,
  @builtin(local_invocation_id) local_id: vec3u,
  @builtin(workgroup_id) wg_id: vec3u
) {
  let chunk_index = global_id.x;
  if ( chunk_index < config.num_input_chunks ) {

    let chunk = input_chunks[ chunk_index ];

    let minClippedChunkIndex = 2u * chunk_index;
    let maxClippedChunkIndex = 2u * chunk_index + 1u;

    let xDiff = chunk.maxX - chunk.minX;
    let yDiff = chunk.maxY - chunk.minY;

    let hasEdges = chunk.numEdges > 0u;
    var minChunk: RasterClippedChunk;
    var maxChunk: RasterClippedChunk;

    if ( hasEdges ) {
      let isXSplit = xDiff > yDiff;

      // NOTE: This is set up so that if we have a half-pixel offset e.g. with a bilinear filter, it will work)
      // NOTE: Duplicated in ParallelRasterInitialClip and ParallelRasterInitialChunk
      var split: f32;
      // TODO: see if we should use select here?
      if ( isXSplit ) {
        split = chunk.minX + floor( 0.5 * xDiff );
      }
      else {
        split = chunk.minY + floor( 0.5 * yDiff );
      }

      minChunk = RasterClippedChunk(
        chunk.bits,
        -1.0,

        // Main bounds of the chunk. NOTE: if enabled, the content will get bounds-checked and possibly these
        // bounds will be reduced.
        chunk.minX,
        chunk.minY,
        select( chunk.maxX, split, isXSplit ),
        select( split, chunk.maxY, isXSplit ),

        chunk.minXCount,
        chunk.minYCount,
        chunk.maxXCount,
        chunk.maxYCount
      );

      maxChunk = RasterClippedChunk(
        chunk.bits,
        -1.0,

        // Main bounds of the chunk. NOTE: if enabled, the content will get bounds-checked and possibly these
        // bounds will be reduced.
        select( chunk.minX, split, isXSplit ),
        select( split, chunk.minY, isXSplit ),
        chunk.maxX,
        chunk.maxY,

        chunk.minXCount,
        chunk.minYCount,
        chunk.maxXCount,
        chunk.maxYCount
      );
    }
    // If our chunk has NO edges, either we get discarded OR we have full area.
    // NOTE: This is assuming no negative or doubled area, or other fun facts, since our clipping process should
    // output things satisfying these constraints.
    else {
      let hasArea = chunk.minXCount < 0i && chunk.minYCount > 0i && chunk.maxXCount > 0i && chunk.maxYCount < 0i;

      if ( hasArea ) {
        // Output a simple "contains everything" chunk in the min section
        minChunk = RasterClippedChunk(
          chunk.bits & RasterClippedChunk_bits_is_complete_mask & RasterClippedChunk_bits_is_full_area_mask,
          xDiff * yDiff,

          chunk.minX, chunk.minY, chunk.maxX, chunk.maxY,
          -1i, 1i, 1i, -1i
        );
      }
      else {
        minChunk = RasterClippedChunk_discardable;
      }

      // We don't want to split the chunk and cause unneeded work, so we just dump everything in the "min" and
      // put data in the "max" that will be discarded
      maxChunk = RasterClippedChunk_discardable;
    }

    clipped_chunks[ minClippedChunkIndex ] = minChunk;
    clipped_chunks[ maxClippedChunkIndex ] = maxChunk;
  }
}
