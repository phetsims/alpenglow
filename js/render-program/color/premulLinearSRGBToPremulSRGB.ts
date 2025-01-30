// Copyright 2025, University of Colorado Boulder

/**
 * Convert a RenderProgram from premultiplied linear sRGB to premultiplied sRGB color space.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { RenderProgram } from '../RenderProgram.js';
import { RenderPremultiply } from '../RenderPremultiply.js';
import { RenderUnpremultiply } from '../RenderUnpremultiply.js';
import { RenderLinearSRGBToSRGB } from '../RenderLinearSRGBToSRGB.js';

export const premulLinearSRGBToPremulSRGB = ( renderProgram: RenderProgram ): RenderProgram => {
  return new RenderPremultiply( new RenderLinearSRGBToSRGB( new RenderUnpremultiply( renderProgram ) ) );
};