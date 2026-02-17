// Copyright 2025, University of Colorado Boulder

/**
 * Convert a RenderProgram from sRGB to Oklab color space.
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import { RenderProgram } from '../RenderProgram.js';
import { RenderLinearSRGBToOklab } from '../RenderLinearSRGBToOklab.js';
import { RenderSRGBToLinearSRGB } from '../RenderSRGBToLinearSRGB.js';

export const sRGBToOklab = ( renderProgram: RenderProgram ): RenderProgram => {
  return new RenderLinearSRGBToOklab( new RenderSRGBToLinearSRGB( renderProgram ) );
};