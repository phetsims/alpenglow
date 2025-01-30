// Copyright 2025, University of Colorado Boulder

/**
 * Convert a RenderProgram from Display P3 to Oklab color space.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { RenderProgram } from '../RenderProgram.js';
import { RenderLinearSRGBToOklab } from '../RenderLinearSRGBToOklab.js';
import { RenderLinearDisplayP3ToLinearSRGB } from '../RenderLinearDisplayP3ToLinearSRGB.js';
import { RenderSRGBToLinearSRGB } from '../RenderSRGBToLinearSRGB.js';

export const displayP3ToOklab = ( renderProgram: RenderProgram ): RenderProgram => {
  return new RenderLinearSRGBToOklab( new RenderLinearDisplayP3ToLinearSRGB( new RenderSRGBToLinearSRGB( renderProgram ) ) );
};