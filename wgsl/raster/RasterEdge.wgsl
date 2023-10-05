// Copyright 2023, University of Colorado Boulder

/**
 * Represents an edge from a RasterChunk
 *
 * Used for the raster-clip input, and the output for reducible edges (that will be fed back in)
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

const RasterEdge_bits_chunk_index_mask: u32 = 0x2fffffff;
const RasterEdge_bits_is_first_edge_mask: u32 = 0x40000000; // NOTE: don't change from RasterChunkReduceData
const RasterEdge_bits_is_last_edge_mask: u32 = 0x80000000;
const RasterEdge_bits_first_last_mask: u32 = RasterEdge_bits_is_first_edge_mask | RasterEdge_bits_is_last_edge_mask;

struct RasterEdge {
  bits: u32, // NOTE: should be same format as RasterEdgeClip

  // TODO: consider vec2fs, see if the alignment change is worth it
  startX: f32,
  startY: f32,
  endX: f32,
  endY: f32
}
