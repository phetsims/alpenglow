// Copyright 2025, University of Colorado Boulder

/**
 * Convert a RenderProgram from premultiplied Display P3 to premultiplied linear sRGB color space.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { RenderProgram } from '../RenderProgram.js';
import { RenderPremultiply } from '../RenderPremultiply.js';
import { displayP3ToLinearSRGB } from './displayP3ToLinearSRGB.js';
import { RenderUnpremultiply } from '../RenderUnpremultiply.js';

export const premulDisplayP3ToPremulLinearSRGB = ( renderProgram: RenderProgram ): RenderProgram => {
  return new RenderPremultiply( displayP3ToLinearSRGB( new RenderUnpremultiply( renderProgram ) ) );
};