// Copyright 2024-2026, University of Colorado Boulder

/**
 * Converts unpremultiplied color to premultiplied color.
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import { wgsl, WGSLExpression, WGSLStringModule } from '../WGSLString.js';

export const premultiplyWGSL = (
  vec4: WGSLExpression
): WGSLExpression => {
  return new WGSLStringModule( 'premultiply', wgsl`premultiply( ${vec4} )`, wgsl`
    fn premultiply( color: vec4f ) -> vec4f {
      return vec4( color.xyz * color.w, color.w );
    }
` );
};