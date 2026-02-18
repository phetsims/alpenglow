// Copyright 2025-2026, University of Colorado Boulder

/**
 * Convert a RenderProgram from premultiplied sRGB to premultiplied Oklab color space.
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import { RenderProgram } from '../RenderProgram.js';
import { RenderPremultiply } from '../RenderPremultiply.js';
import { sRGBToOklab } from './sRGBToOklab.js';
import { RenderUnpremultiply } from '../RenderUnpremultiply.js';

export const premulSRGBToPremulOklab = ( renderProgram: RenderProgram ): RenderProgram => {
  return new RenderPremultiply( sRGBToOklab( new RenderUnpremultiply( renderProgram ) ) );
};