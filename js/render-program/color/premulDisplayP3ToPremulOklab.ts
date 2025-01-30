// Copyright 2025, University of Colorado Boulder

/**
 * Convert a RenderProgram from premultiplied Display P3 to premultiplied Oklab color space.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { RenderProgram } from '../RenderProgram.js';
import { RenderPremultiply } from '../RenderPremultiply.js';
import { displayP3ToOklab } from './displayP3ToOklab.js';
import { RenderUnpremultiply } from '../RenderUnpremultiply.js';

export const premulDisplayP3ToPremulOklab = ( renderProgram: RenderProgram ): RenderProgram => {
  return new RenderPremultiply( displayP3ToOklab( new RenderUnpremultiply( renderProgram ) ) );
};