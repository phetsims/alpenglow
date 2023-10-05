// Copyright 2023, University of Colorado Boulder

/**
 * Output chunk for the raster-clip algorithm
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

const RasterCompleteChunk_bits_raster_program_index_mask: u32 = 0x00ffffff;
const RasterCompleteChunk_bits_is_full_area_mask: u32 = 0x20000000;

struct RasterCompleteChunk {
  bits: u32,

  edgesOffset: u32,
  numEdges: u32,

  // Filled in by early steps
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
