// Copyright 2023, University of Colorado Boulder

/**
 * We do the following:
 *
 * 1. Binary clip each RasterEdge into two RasterEdgeClips (one for each side of the split)
 * 2. Take these, do a segmented parallel reduction, and
 * 3. During reduction, store associated data to the RasterClippedChunks (precisely when we have reduced all of the
 *    edges for a particular chunk)
 *
 * NOTE: The reduction is also completed in ParallelRasterChunkReduce, so if changing this file, please check there too
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./RasterChunk
#import ./RasterEdge
#import ./RasterClippedChunk
#import ./RasterChunkReducePair
#import ./RasterChunkReduceQuad
#import ./RasterStageConfig

#bindings

fn apply_to_clipped_chunk( value: ptr<function,RasterChunkReducePair>, clipped_chunk: ptr<storage,RasterClippedChunk> ) -> void {

  let minXCount = (*clipped_chunk).minXCount + (*value).minXCount;
  let minYCount = (*clipped_chunk).minYCount + (*value).minYCount;
  let maxXCount = (*clipped_chunk).maxXCount + (*value).maxXCount;
  let maxYCount = (*clipped_chunk).maxYCount + (*value).maxYCount;

  let clippedMinX = (*clipped_chunk).minX;
  let clippedMinY = (*clipped_chunk).minY;
  let clippedMaxX = (*clipped_chunk).maxX;
  let clippedMaxY = (*clipped_chunk).maxY;

  // TODO: test with/without the bounds computation (potentially have conditional compilation)
  // NOTE: Our clipped edge counts will affect our bounds, so we have lots of conditionals here.
  // If they are NOT affected by the clipped edge counts, we can see if we can shrink the bounds.
  // We're anticipating potential fractional values here, so we difference with the floors.
  // (fractional can happen with offsets from various filters).
  let minX = select(
    clippedMinX,
    clippedMinX + floor( (*value).minX - clippedMinX ),
    minXCount == 0i && minYCount == 0i && maxYCount == 0i
  );
  let minY = select(
    clippedMinY,
    clippedMinY + floor( (*value).minY - clippedMinY ),
    minXCount == 0i && minYCount == 0i && maxXCount == 0i
  );
  let maxX = select(
    clippedMaxX,
    clippedMaxX - floor( clippedMaxX - (*value).maxX ),
    maxXCount == 0i && minYCount == 0i && maxYCount == 0i
  );
  let maxY = select(
    clippedMaxY,
    clippedMaxY - floor( clippedMaxY - (*value).maxY ),
    minXCount == 0i && maxXCount == 0i && maxYCount == 0i
  );

  // NOTE: This ASSUMES that we're using the specific shoelace formulation of ( p1.x + p0.x ) * ( p1.y - p0.y )
  // for the rest of our computations
  // Our minYCount/maxYCount won't contribute (since they have the same Y values, their shoelace contribution will be
  // zero.
  // ALSO: there is a doubling and non-doubling that cancel out here (1/2 from shoelace, 2* due to x+x).
  let countArea = ( clippedMaxY - clippedMinY ) * ( minXCount * clippedMinX + maxXCount * clippedMaxX );

  // Include both area from the clipped-edge counts AND from the actual edges themselves
  let area = countArea + (*value).area;

  let width = maxX - minX;
  let height = maxY - minY;

  // TODO: change our general precision here (1e-6 for zero, 1e-4 for full area?)
  // TODO: factor out some of these epsilons into constants
  let isDiscarded = area <= 1.0e-6;
  let isFullArea = area >= width * height - 1.0e-4;
  let isComplete = isDiscarded || isFullArea || ( width <= 1.0 + 1.0e-5 && height <= 1 + 1.0e-5 );

  *clipped_chunk = RasterClippedChunk(
    (*clipped_chunk).bits |
    select( 0u, RasterClippedChunk_bits_is_reducible_mask, !isComplete ) |
    select( 0u, RasterClippedChunk_bits_is_complete_mask, isComplete && !isDiscarded ) |
    select( 0u, RasterClippedChunk_bits_is_full_area_mask, isFullArea ),

    area,

    minX, minY, maxX, maxY,
    minXCount, minYCount, maxXCount, maxYCount
  );
};
