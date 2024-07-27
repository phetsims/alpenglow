// Copyright 2024, University of Colorado Boulder

import { wgsl, WGSLExpression, WGSLStringModule } from '../../../imports.js';

/**
 * Converts unpremultiplied color to premultiplied color.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

export default (
  vec4: WGSLExpression
): WGSLExpression => {
  return new WGSLStringModule( 'premultiply', wgsl`premultiply( ${vec4} )`, wgsl`
    fn premultiply( color: vec4f ) -> vec4f {
      return vec4( color.xyz * color.w, color.w );
    }
` );
};