// Copyright 2023-2024, University of Colorado Boulder

/**
 * Controls how images get resampled when output
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow } from '../alpenglow.js';

export enum RenderResampleType {
  // TODO: maybe... sort these?
  NearestNeighbor = 0,
  AnalyticMitchellNetravali = 1,
  Bilinear = 2,
  MitchellNetravali = 3,
  AnalyticBox = 4,
  AnalyticBilinear = 5
}

alpenglow.register( 'RenderResampleType', RenderResampleType );