// Copyright 2023, University of Colorado Boulder

/**
 * Represents an edge from a RasterCompleteEdgeChunk
 *
 * Output edge for the raster-clip algorithm
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

struct RasterCompleteEdge {
  // TODO: vec2fs, since it doesn't change alignment?
  startX: f32,
  startY: f32,
  endX: f32,
  endY: f32
}
