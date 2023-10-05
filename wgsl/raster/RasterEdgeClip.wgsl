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
const RasterEdgeClip_bits_first_last_mask: u32 = RasterEdgeClip_bits_is_first_edge_mask | RasterEdgeClip_bits_is_last_edge_mask;

struct RasterEdgeClip {
  bits: u32, // NOTE: should be same format as RasterEdge

  // TODO: consider vec2fs, see if the alignment change is worth it
  p0x: f32,
  p0y: f32,
  p1x: f32,
  p1y: f32,
  p2x: f32,
  p2y: f32,
  p3x: f32,
  p3y: f32
}

fn RasterEdgeClip_getCount( edge_clip: ptr<function, RasterEdgeClip> ) -> u32 {
  return select( 1u, 0u, (*edge_clip).p0x == (*edge_clip).p1x && (*edge_clip).p0y == (*edge_clip).p1y ) +
         select( 1u, 0u, (*edge_clip).p1x == (*edge_clip).p2x && (*edge_clip).p1y == (*edge_clip).p2y ) +
         select( 1u, 0u, (*edge_clip).p2x == (*edge_clip).p3x && (*edge_clip).p2y == (*edge_clip).p3y );
}

fn RasterEdgeClip_getArea( edge_clip: ptr<function, RasterEdgeClip> ) -> f32 {
  return 0.5 * (
    ( (*edge_clip).p1x + (*edge_clip).p0x ) * ( (*edge_clip).p1y - (*edge_clip).p0y ) +
    ( (*edge_clip).p2x + (*edge_clip).p1x ) * ( (*edge_clip).p2y - (*edge_clip).p1y ) +
    ( (*edge_clip).p3x + (*edge_clip).p2x ) * ( (*edge_clip).p3y - (*edge_clip).p2y )
  );
}
