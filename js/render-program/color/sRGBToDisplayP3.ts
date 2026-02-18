// Copyright 2025-2026, University of Colorado Boulder

/**
 * Convert a RenderProgram from sRGB to Display P3 color space.
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import { RenderProgram } from '../RenderProgram.js';
import { RenderLinearSRGBToLinearDisplayP3 } from '../RenderLinearSRGBToLinearDisplayP3.js';
import { RenderSRGBToLinearSRGB } from '../RenderSRGBToLinearSRGB.js';
import { RenderLinearSRGBToSRGB } from '../RenderLinearSRGBToSRGB.js';

export const sRGBToDisplayP3 = ( renderProgram: RenderProgram ): RenderProgram => {
  return new RenderLinearSRGBToSRGB( new RenderLinearSRGBToLinearDisplayP3( new RenderSRGBToLinearSRGB( renderProgram ) ) );
};