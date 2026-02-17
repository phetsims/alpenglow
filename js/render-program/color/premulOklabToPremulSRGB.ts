// Copyright 2025, University of Colorado Boulder

/**
 * Convert a RenderProgram from premultiplied Oklab to premultiplied sRGB color space.
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import { RenderProgram } from '../RenderProgram.js';
import { RenderPremultiply } from '../RenderPremultiply.js';
import { oklabToSRGB } from './oklabToSRGB.js';
import { RenderUnpremultiply } from '../RenderUnpremultiply.js';

export const premulOklabToPremulSRGB = ( renderProgram: RenderProgram ): RenderProgram => {
  return new RenderPremultiply( oklabToSRGB( new RenderUnpremultiply( renderProgram ) ) );
};