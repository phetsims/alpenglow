// Copyright 2025, University of Colorado Boulder

/**
 * Convert a RenderProgram from Oklab to Display P3 color space.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { RenderLinearSRGBToSRGB } from '../RenderLinearSRGBToSRGB.js';
import { RenderProgram } from '../RenderProgram.js';
import { RenderLinearSRGBToLinearDisplayP3 } from '../RenderLinearSRGBToLinearDisplayP3.js';
import { RenderOklabToLinearSRGB } from '../RenderOklabToLinearSRGB.js';

export const oklabToDisplayP3 = ( renderProgram: RenderProgram ): RenderProgram => {
  return new RenderLinearSRGBToSRGB( new RenderLinearSRGBToLinearDisplayP3( new RenderOklabToLinearSRGB( renderProgram ) ) );
};