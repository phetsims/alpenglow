// Copyright 2025, University of Colorado Boulder

/**
 * Convert a RenderProgram from premultiplied sRGB to premultiplied linear sRGB color space.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { RenderProgram } from '../RenderProgram.js';
import { RenderPremultiply } from '../RenderPremultiply.js';
import { RenderSRGBToLinearSRGB } from '../RenderSRGBToLinearSRGB.js';
import { RenderUnpremultiply } from '../RenderUnpremultiply.js';

export const premulSRGBToPremulLinearSRGB = ( renderProgram: RenderProgram ): RenderProgram => {
  return new RenderPremultiply( new RenderSRGBToLinearSRGB( new RenderUnpremultiply( renderProgram ) ) );
};