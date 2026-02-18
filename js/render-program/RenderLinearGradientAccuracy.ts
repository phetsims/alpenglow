// Copyright 2025-2026, University of Colorado Boulder

/**
 * Linear gradient accuracy
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

export enum RenderLinearGradientAccuracy {
  SplitAccurate = 0,
  SplitPixelCenter = 1,
  UnsplitCentroid = 2,
  UnsplitPixelCenter = 3
  // Restricted to 2-bit length, if adding more, check serialization to binary
}