// Copyright 2023, University of Colorado Boulder

/**
 * Controls how images get resampled when output
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { scenery } from '../../../imports.js';

enum RenderResampleType {
  NearestNeighbor = 0,
  AnalyticMitchellNetravali = 1
}

export default RenderResampleType;

scenery.register( 'RenderResampleType', RenderResampleType );
