// Copyright 2025-2026, University of Colorado Boulder

/**
 * Convert a RenderProgram from premultiplied Oklab to premultiplied Display P3 color space.
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import { RenderProgram } from '../RenderProgram.js';
import { RenderPremultiply } from '../RenderPremultiply.js';
import { oklabToDisplayP3 } from './oklabToDisplayP3.js';
import { RenderUnpremultiply } from '../RenderUnpremultiply.js';

export const premulOklabToPremulDisplayP3 = ( renderProgram: RenderProgram ): RenderProgram => {
  return new RenderPremultiply( oklabToDisplayP3( new RenderUnpremultiply( renderProgram ) ) );
};