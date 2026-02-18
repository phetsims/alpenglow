// Copyright 2025-2026, University of Colorado Boulder

/**
 * Convert a RenderProgram from Display P3 to sRGB color space.
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import { RenderLinearSRGBToSRGB } from '../RenderLinearSRGBToSRGB.js';
import { RenderProgram } from '../RenderProgram.js';
import { RenderLinearDisplayP3ToLinearSRGB } from '../RenderLinearDisplayP3ToLinearSRGB.js';
import { RenderSRGBToLinearSRGB } from '../RenderSRGBToLinearSRGB.js';

export const displayP3ToSRGB = ( renderProgram: RenderProgram ): RenderProgram => {
  return new RenderLinearSRGBToSRGB( new RenderLinearDisplayP3ToLinearSRGB( new RenderSRGBToLinearSRGB( renderProgram ) ) );
};