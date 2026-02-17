// Copyright 2024-2025, University of Colorado Boulder

/**
 * Converts a linear sRGB color to sRGB color space. This applies the gamma correction.
 *
 * See RenderColor.linearToSRGB for more information.
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import { wgsl, WGSLExpression, WGSLStringModule } from '../WGSLString.js';

export const linear_sRGB_to_sRGBWGSL = (
  vec3: WGSLExpression
): WGSLExpression => {
  // https://entropymine.com/imageworsener/srgbformula/ (a more precise formula for sRGB)
  // Linear to sRGB
  // 0 ≤ L ≤ 0.00313066844250063 : S = L×12.92
  // 0.00313066844250063 < L ≤ 1 : S = 1.055×L^1/2.4 − 0.055
  return new WGSLStringModule( 'linear_sRGB_to_sRGB', wgsl`linear_sRGB_to_sRGB( ${vec3} )`, wgsl`
    const lss_inv_gamma = 1.0 / 2.4;
    
    fn linear_sRGB_to_sRGB( color: vec3f ) -> vec3f {
      return select( 1.055 * pow( color, vec3( lss_inv_gamma ) ) - 0.055, color * 12.92, color <= vec3( 0.00313066844250063 ) );
    }
` );
};