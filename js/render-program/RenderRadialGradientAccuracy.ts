// Copyright 2025, University of Colorado Boulder

/**
 * Radial gradient accuracy
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

export enum RenderRadialGradientAccuracy {
  SplitAccurate = 0,
  SplitCentroid = 1,
  SplitPixelCenter = 2,
  UnsplitCentroid = 3,
  UnsplitPixelCenter = 4
  // Restricted to 3-bit length, if adding more, check serialization to binary
}