// Copyright 2023-2026, University of Colorado Boulder

/**
 * Controls how images get resampled when output
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

export enum RenderResampleType {
  // TODO: maybe... sort these?
  NearestNeighbor = 0,
  AnalyticMitchellNetravali = 1,
  Bilinear = 2,
  MitchellNetravali = 3,
  AnalyticBox = 4,
  AnalyticBilinear = 5
}
