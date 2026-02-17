// Copyright 2024-2025, University of Colorado Boulder

/**
 * Converts an oklab color to the linear sRGB color space.
 *
 * See RenderColor.oklabToLinear for more information.
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import { wgsl, WGSLExpression, WGSLStringModule } from '../WGSLString.js';

export const oklab_to_linear_sRGBWGSL = (
  vec3: WGSLExpression
): WGSLExpression => {
  return new WGSLStringModule( 'oklab_to_linear_sRGB', wgsl`oklab_to_linear_sRGB( ${vec3} )`, wgsl`
    fn oklab_to_linear_sRGB( color: vec3f ) -> vec3f {
      let l_ = color.x + 0.3963377774 * color.y + 0.2158037573 * color.z;
      let m_ = color.x - 0.1055613458 * color.y - 0.0638541728 * color.z;
      let s_ = color.x - 0.0894841775 * color.y - 1.2914855480 * color.z;
    
      let l = l_ * l_ * l_;
      let m = m_ * m_ * m_;
      let s = s_ * s_ * s_;
    
      return vec3(
        4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
        -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
        -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
      );
    }
` );
};