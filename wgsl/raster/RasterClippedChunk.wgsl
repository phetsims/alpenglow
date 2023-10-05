// Copyright 2023, University of Colorado Boulder

/**
 * A clipped part of a RasterChunk, which will get filled with data during reduction.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

const RasterClippedChunk_bits_raster_program_index_mask: u32 = 0x00ffffff;
const RasterClippedChunk_bits_is_reducible_mask: u32 = 0x08000000; // filled in later
const RasterClippedChunk_bits_is_complete_mask: u32 = 0x10000000; // filled in later
const RasterClippedChunk_bits_is_full_area_mask: u32 = 0x20000000; // filled in later
const RasterClippedChunk_bits_needs_face_mask: u32 = 0x40000000;
const RasterClippedChunk_bits_is_constant_mask: u32 = 0x80000000;

struct RasterClippedChunk {
  bits: u32,

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

const RasterClippedChunk_discardable = RasterClippedChunk(
  0u,
  0.0,
  0.0, 0.0, 0.0, 0.0,
  0i, 0i, 0i, 0i
);
