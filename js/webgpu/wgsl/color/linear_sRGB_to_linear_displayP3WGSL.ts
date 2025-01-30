// Copyright 2024, University of Colorado Boulder

/**
 * Converts a linear sRGB color to the linear Display-P3 color space
 *
 * See RenderColor.linearToLinearDisplayP3 for more information.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { wgsl, WGSLExpression, WGSLStringModule } from '../WGSLString.js';

export const linear_sRGB_to_linear_displayP3WGSL = (
  vec3: WGSLExpression
): WGSLExpression => {
  return new WGSLStringModule( 'linear_sRGB_to_linear_displayP3', wgsl`linear_sRGB_to_linear_displayP3( ${vec3} )`, wgsl`
    fn linear_sRGB_to_linear_displayP3( color: vec3f ) -> vec3f {
      // Formulas from computations in RenderColor
      return vec3(
        0.8224689734082459 * color.r + 0.17753102659175413 * color.g,
        0.03319573842230447 * color.r + 0.9668042615776956 * color.g,
        0.017085772151775966 * color.r + 0.07240728066524241 * color.g + 0.9105069471829815 * color.b
      );
    }
` );
};