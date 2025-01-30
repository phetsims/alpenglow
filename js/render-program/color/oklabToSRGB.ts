// Copyright 2025, University of Colorado Boulder

/**
 * Convert a RenderProgram from Oklab to sRGB color space.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { RenderProgram } from '../RenderProgram.js';
import { RenderOklabToLinearSRGB } from '../RenderOklabToLinearSRGB.js';
import { RenderLinearSRGBToSRGB } from '../RenderLinearSRGBToSRGB.js';

export const oklabToSRGB = ( renderProgram: RenderProgram ): RenderProgram => {
  return new RenderLinearSRGBToSRGB( new RenderOklabToLinearSRGB( renderProgram ) );
};