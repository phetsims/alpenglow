// Copyright 2025, University of Colorado Boulder

/**
 * Convert a RenderProgram from Display P3 to linear sRGB color space.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { RenderProgram } from '../RenderProgram.js';
import { RenderSRGBToLinearSRGB } from '../RenderSRGBToLinearSRGB.js';
import { RenderLinearDisplayP3ToLinearSRGB } from '../RenderLinearDisplayP3ToLinearSRGB.js';

export const displayP3ToLinearSRGB = ( renderProgram: RenderProgram ): RenderProgram => {
  return new RenderLinearDisplayP3ToLinearSRGB( new RenderSRGBToLinearSRGB( renderProgram ) );
};