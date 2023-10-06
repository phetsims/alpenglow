// Copyright 2023, University of Colorado Boulder

/**
 * Represents an "applied interval" of reduce data, for both the min and max binary clips.
 *
 * In our segmented reduction, at each level we need to track intervals with the "fragments" of chunks' edges that
 * have not been completed yet.
 *
 * "left" means "the reduction of all values for the chunk index at the start of this interval"
 * "right" means "the reduction of all values for the chunk index at the end of this interval"
 *
 * Sometimes the left/right are equal (IFF they have the same chunk index).
 *
 * Each reduced data notes whether it contains the first/last edge of the chunk it references. Once we combine reduces
 * so that it contains both the first and last edge, we can "apply" it, moving the reduced data into the chunk.
 *
 * TODO: produce general documentation on this whole process.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./RasterChunkReduceData

struct RasterChunkReduceQuad {
  leftMin: RasterChunkReduceData,
  leftMax: RasterChunkReduceData,
  rightMin: RasterChunkReduceData,
  rightMax: RasterChunkReduceData
}

fn RasterChunkReduceQuad_combine(
  a: RasterChunkReduceQuad,
  b: RasterChunkReduceQuad
) -> RasterChunkReduceQuad {
  var leftMin = a.leftMin;
  var leftMax = a.leftMax;

  // We need separate logic for the "left" combine, due to the combine "taking" the right side
  if (
    ( a.leftMin.bits & RasterChunkReduceData_bits_clipped_chunk_index_mask ) ==
    ( b.leftMin.bits & RasterChunkReduceData_bits_clipped_chunk_index_mask )
  ) {
    leftMin = RasterChunkReduceData_combine( a.leftMin, b.leftMin );
  }
  if (
    ( a.leftMax.bits & RasterChunkReduceData_bits_clipped_chunk_index_mask ) ==
    ( b.leftMax.bits & RasterChunkReduceData_bits_clipped_chunk_index_mask )
  ) {
    leftMax = RasterChunkReduceData_combine( a.leftMax, b.leftMax );
  }

  let rightMin = RasterChunkReduceData_combine( a.rightMin, b.rightMin );
  let rightMax = RasterChunkReduceData_combine( a.rightMax, b.rightMax );

  return RasterChunkReduceQuad(
    leftMin,
    leftMax,
    rightMin,
    rightMax
  );
}

const RasterChunkReduceQuad_out_of_range = RasterChunkReduceQuad(
  RasterChunkReduceData_out_of_range,
  RasterChunkReduceData_out_of_range,
  RasterChunkReduceData_out_of_range,
  RasterChunkReduceData_out_of_range
);
