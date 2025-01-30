// Copyright 2025, University of Colorado Boulder

/**
 * Convert a RenderProgram from linear sRGB to Display P3 color space.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { RenderProgram } from '../RenderProgram.js';
import { RenderLinearSRGBToLinearDisplayP3 } from '../RenderLinearSRGBToLinearDisplayP3.js';
import { RenderLinearSRGBToSRGB } from '../RenderLinearSRGBToSRGB.js';

export const linearSRGBToDisplayP3 = ( renderProgram: RenderProgram ): RenderProgram => {
  return new RenderLinearSRGBToSRGB( new RenderLinearSRGBToLinearDisplayP3( renderProgram ) );
};