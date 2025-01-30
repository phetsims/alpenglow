// Copyright 2025, University of Colorado Boulder

/**
 * Linear gradient accuracy
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

export enum RenderLinearGradientAccuracy {
  SplitAccurate = 0,
  SplitPixelCenter = 1,
  UnsplitCentroid = 2,
  UnsplitPixelCenter = 3
  // Restricted to 2-bit length, if adding more, check serialization to binary
}