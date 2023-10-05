// Copyright 2023, University of Colorado Boulder

/**
 * Represents the clipped state of a RasterEdge. For the binary version, there will be two of these edge clips per
 * input edge.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

const RasterEdgeClip_bits_clipped_chunk_index_mask: u32 = 0x2fffffff;
const RasterEdgeClip_bits_is_first_edge_mask: u32 = 0x40000000;
const RasterEdgeClip_bits_is_last_edge_mask: u32 = 0x80000000;

struct RasterEdgeClip {
  bits: u32,

  p0x: f32,
  p0y: f32,
  p1x: f32,
  p1y: f32,
  p2x: f32,
  p2y: f32,
  p3x: f32,
  p3y: f32
}
