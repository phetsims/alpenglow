// Copyright 2024, University of Colorado Boulder

/**
 * Converts a linear Display-P3 color to the linear sRGB color space
 *
 * See RenderColor.linearDisplayP3ToLinear for more information.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { wgsl, WGSLExpression, WGSLStringModule } from '../WGSLString.js';

export const linear_displayP3_to_linear_sRGBWGSL = (
  vec3: WGSLExpression
): WGSLExpression => {
  return new WGSLStringModule( 'linear_displayP3_to_linear_sRGB', wgsl`linear_displayP3_to_linear_sRGB( ${vec3} )`, wgsl`
    fn linear_displayP3_to_linear_sRGB( color: vec3f ) -> vec3f {
      // Formulas from computations in RenderColor
      return vec3(
        1.2249297438736997 * color.r + -0.2249297438736996 * color.g,
        -0.04205861411592876 * color.r + 1.0420586141159287 * color.g,
        -0.019641278613420788 * color.r + -0.07864798001761002 * color.g + 1.0982892586310309 * color.b
      );
    }
` );
};