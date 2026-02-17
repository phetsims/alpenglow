// Copyright 2025, University of Colorado Boulder

/**
 * Convert a RenderProgram from premultiplied Display P3 to premultiplied sRGB color space.
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import { RenderProgram } from '../RenderProgram.js';
import { RenderPremultiply } from '../RenderPremultiply.js';
import { displayP3ToSRGB } from './displayP3ToSRGB.js';
import { RenderUnpremultiply } from '../RenderUnpremultiply.js';

export const premulDisplayP3ToPremulSRGB = ( renderProgram: RenderProgram ): RenderProgram => {
  return new RenderPremultiply( displayP3ToSRGB( new RenderUnpremultiply( renderProgram ) ) );
};