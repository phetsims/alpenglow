// Copyright 2025, University of Colorado Boulder

/**
 * Convert a RenderProgram from premultiplied sRGB to premultiplied Display P3 color space.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { RenderProgram } from '../RenderProgram.js';
import { RenderPremultiply } from '../RenderPremultiply.js';
import { sRGBToDisplayP3 } from './sRGBToDisplayP3.js';
import { RenderUnpremultiply } from '../RenderUnpremultiply.js';

export const premulSRGBToPremulDisplayP3 = ( renderProgram: RenderProgram ): RenderProgram => {
  return new RenderPremultiply( sRGBToDisplayP3( new RenderUnpremultiply( renderProgram ) ) );
};