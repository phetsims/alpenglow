// Copyright 2025, University of Colorado Boulder

/**
 * Convert a RenderProgram from premultiplied Oklab to premultiplied Display P3 color space.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { RenderProgram } from '../RenderProgram.js';
import { RenderPremultiply } from '../RenderPremultiply.js';
import { oklabToDisplayP3 } from './oklabToDisplayP3.js';
import { RenderUnpremultiply } from '../RenderUnpremultiply.js';

export const premulOklabToPremulDisplayP3 = ( renderProgram: RenderProgram ): RenderProgram => {
  return new RenderPremultiply( oklabToDisplayP3( new RenderUnpremultiply( renderProgram ) ) );
};