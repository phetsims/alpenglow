// Copyright 2023, University of Colorado Boulder

/**
 * Contains path data within a bounds, for a particular RenderProgram
 *
 * Used for the raster-clip input, and the output for reducible chunks (that will be fed back in)
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

const RasterChunk_bits_raster_program_index_mask: u32 = 0x00ffffff;
const RasterChunk_bits_needs_face_mask: u32 = 0x40000000;
const RasterChunk_bits_is_constant_mask: u32 = 0x80000000;

struct RasterChunk {
  // See constants above for what is stored here
  bits: u32,

  numEdges: u32,
  edgesOffset: u32,

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
