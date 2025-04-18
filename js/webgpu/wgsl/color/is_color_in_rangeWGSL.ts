// Copyright 2024-2025, University of Colorado Boulder

/**
 * Returns whether a color is in the standard (0-1) range for every color channel.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { wgsl, WGSLExpression, WGSLExpressionBool, WGSLStringModule } from '../WGSLString.js';

export const is_color_in_rangeWGSL = (
  vec3: WGSLExpression
): WGSLExpressionBool => {
  // We only care about the color channels, not the alpha (we'll presume we aren't premultiplied)
  return new WGSLStringModule( 'is_color_in_range', wgsl`is_color_in_range( ${vec3} )`, wgsl`
    fn is_color_in_range( color: vec3f ) -> bool {
      return all( color >= vec3( 0f ) ) && all( color <= vec3( 1f ) );
    }
` );
};