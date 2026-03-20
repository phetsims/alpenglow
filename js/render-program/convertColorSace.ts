// Copyright 2025-2026, University of Colorado Boulder

/**
 * Convenience method for converting a RenderProgram from one color space to another.
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import { RenderColorSpace } from './RenderColorSpace.js';
import { RenderProgram } from './RenderProgram.js';
import { alpenglow } from '../alpenglow.js';
import { RenderUnpremultiply } from './RenderUnpremultiply.js';
import { RenderPremultiply } from './RenderPremultiply.js';

export const convertColorSpace = (
  renderProgram: RenderProgram,
  fromSpace: RenderColorSpace,
  toSpace: RenderColorSpace
): RenderProgram => {
  if ( fromSpace === toSpace ) {
    return renderProgram;
  }

  if ( fromSpace.isPremultiplied ) {
    renderProgram = new RenderUnpremultiply( renderProgram );
  }
  if ( !fromSpace.isLinear ) {
    renderProgram = fromSpace.toLinearRenderProgram!( renderProgram );
  }
  renderProgram = fromSpace.linearToLinearSRGBRenderProgram!( renderProgram );
  renderProgram = toSpace.linearSRGBToLinearRenderProgram!( renderProgram );
  if ( !toSpace.isLinear ) {
    renderProgram = toSpace.fromLinearRenderProgram!( renderProgram );
  }
  if ( toSpace.isPremultiplied ) {
    renderProgram = new RenderPremultiply( renderProgram );
  }
  return renderProgram.simplified();
};
alpenglow.register( 'convertColorSpace', convertColorSpace );