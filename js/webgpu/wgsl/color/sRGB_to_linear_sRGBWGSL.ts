// Copyright 2024-2025, University of Colorado Boulder

/**
 * Converts sRGB to linear sRGB color space.
 *
 * See RenderColor.sRGBToLinear for more information.
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import { wgsl, WGSLExpression, WGSLStringModule } from '../WGSLString.js';

export const sRGB_to_linear_sRGBWGSL = (
  vec3: WGSLExpression
): WGSLExpression => {
  // https://entropymine.com/imageworsener/srgbformula/ (a more precise formula for sRGB)
  // sRGB to Linear
  // 0 ≤ S ≤ 0.0404482362771082 : L = S/12.92
  // 0.0404482362771082 < S ≤ 1 : L = ((S+0.055)/1.055)^2.4
  return new WGSLStringModule( 'sRGB_to_linear_sRGB', wgsl`sRGB_to_linear_sRGB( ${vec3} )`, wgsl`
    const sls_inv_1055 = 1.0 / 1.055;
    const sls_inv_1292 = 1.0 / 12.92;
    
    fn sRGB_to_linear_sRGB( color: vec3f ) -> vec3f {
      return select( pow( ( color + 0.055 ) * sls_inv_1055, vec3( 2.4 ) ), color * sls_inv_1292, color <= vec3( 0.0404482362771082 ) );
    }
` );
};