// Copyright 2025, University of Colorado Boulder

/**
 * Convert a RenderProgram from premultiplied linear sRGB to premultiplied Display P3 color space.
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import { RenderProgram } from '../RenderProgram.js';
import { RenderPremultiply } from '../RenderPremultiply.js';
import { linearSRGBToDisplayP3 } from './linearSRGBToDisplayP3.js';
import { RenderUnpremultiply } from '../RenderUnpremultiply.js';

export const premulLinearSRGBToPremulDisplayP3 = ( renderProgram: RenderProgram ): RenderProgram => {
  return new RenderPremultiply( linearSRGBToDisplayP3( new RenderUnpremultiply( renderProgram ) ) );
};