// Copyright 2024-2025, University of Colorado Boulder

/**
 * Converts premultiplied color to unpremultiplied color.
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import { wgsl, WGSLExpression, WGSLStringModule } from '../WGSLString.js';

export const unpremultiplyWGSL = (
  vec4: WGSLExpression
): WGSLExpression => {
  return new WGSLStringModule( 'unpremultiply', wgsl`unpremultiply( ${vec4} )`, wgsl`
    fn unpremultiply( color: vec4f ) -> vec4f {
      // Max with a small epsilon to avoid NaNs
      let a_inv = 1.0 / max( color.a, 1e-6 );
    
      return vec4( color.rgb * a_inv, color.a );
    }
` );
};