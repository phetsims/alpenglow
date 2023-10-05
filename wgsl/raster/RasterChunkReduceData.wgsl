// Copyright 2023, University of Colorado Boulder

/**
 * (Partial) data for a single clipped chunk, which is reduced and then when complete (isFirstEdge && isLastEdge) is
 * applied to the clipped chunk.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

const RasterChunkReduceData_bits_clipped_chunk_index_mask: u32 = 0x2fffffff;
const RasterChunkReduceData_bits_is_first_edge_mask: u32 = 0x40000000;
const RasterChunkReduceData_bits_is_last_edge_mask: u32 = 0x80000000;

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

const RasterChunkReduceData_out_of_range = RasterChunkReduceData(
  0x2fffffff,
  0.0,
  0.0, 0.0, 0.0, 0.0,
  0i, 0i, 0i, 0i
);
