// Copyright 2023, University of Colorado Boulder

/**
 * (Partial) data for a single clipped chunk, which is reduced and then when complete (isFirstEdge && isLastEdge) is
 * applied to the clipped chunk.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

// TODO: cleanup bits, since we use first/last in multiple places, they should be controlled in one place
const RasterChunkReduceData_bits_clipped_chunk_index_mask: u32 = 0x2fffffff;
const RasterChunkReduceData_bits_is_first_edge_mask: u32 = 0x40000000; // NOTE: don't change from RasterEdge
const RasterChunkReduceData_bits_is_last_edge_mask: u32 = 0x80000000;
const RasterChunkReduceData_bits_first_last_mask: u32 = RasterChunkReduceData_bits_is_first_edge_mask | RasterChunkReduceData_bits_is_last_edge_mask;

struct RasterChunkReduceData {
  bits: u32,

  area: f32,

   // Floating point (typically integral or offset by 0.5) bounds.
  minX: f32,
  minY: f32,
  maxX: f32,
  maxY: f32,

  // EdgedClipped counts. See EdgedClippedFace for details.
  minXCount: i32,
  minYCount: i32,
  maxXCount: i32,
  maxYCount: i32
}

fn RasterChunkReduceData_combine(
  a: RasterChunkReduceData,
  b: RasterChunkReduceData
) -> RasterChunkReduceData {
  let a_clipped_chunk_index = ( a.bits & RasterChunkReduceData_bits_clipped_chunk_index_mask );
  if ( a_clipped_chunk_index != ( b.bits & RasterChunkReduceData_bits_clipped_chunk_index_mask ) ) {
    return b;
  }
  else {
    return RasterChunkReduceData(
      a_clipped_chunk_index |
      ( a.bits & RasterChunkReduceData_bits_is_first_edge_mask ) |
      ( b.bits & RasterChunkReduceData_bits_is_last_edge_mask ),
      a.area + b.area,
      min( a.minX, b.minX ),
      min( a.minY, b.minY ),
      max( a.maxX, b.maxX ),
      max( a.maxY, b.maxY ),
      a.minXCount + b.minXCount,
      a.minYCount + b.minYCount,
      a.maxXCount + b.maxXCount,
      a.maxYCount + b.maxYCount
    );
  }
}

const RasterChunkReduceData_out_of_range = RasterChunkReduceData(
  0x2fffffff,
  0.0,
  0.0, 0.0, 0.0, 0.0,
  0i, 0i, 0i, 0i
);
