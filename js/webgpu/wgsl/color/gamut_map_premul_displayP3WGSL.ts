// Copyright 2024-2025, University of Colorado Boulder

/**
 * Converts premultiplied Display-P3 => Display-P3, while ensuring the color is within the Display-P3 gamut.
 *
 * See RenderColor.gamutMapPremultipliedDisplayP3 for more information.
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import { wgsl, WGSLExpression, WGSLStringModule } from '../WGSLString.js';
import { linear_sRGB_to_sRGBWGSL } from './linear_sRGB_to_sRGBWGSL.js';
import { gamut_map_linear_displayP3WGSL } from './gamut_map_linear_displayP3WGSL.js';
import { sRGB_to_linear_sRGBWGSL } from './sRGB_to_linear_sRGBWGSL.js';
import { unpremultiplyWGSL } from './unpremultiplyWGSL.js';

export const gamut_map_premul_displayP3WGSL = (
  vec4: WGSLExpression
): WGSLExpression => {
  return new WGSLStringModule( 'gamut_map_premul_displayP3', wgsl`gamut_map_premul_displayP3( ${vec4} )`, wgsl`
    fn gamut_map_premul_displayP3( color: vec4f ) -> vec4f {
      if ( color.a <= 1e-8f ) {
        return vec4( 0f );
      }
    
      return vec4(
        ${linear_sRGB_to_sRGBWGSL( gamut_map_linear_displayP3WGSL( sRGB_to_linear_sRGBWGSL( wgsl`${unpremultiplyWGSL( wgsl`color` )}.rgb` ) ) )},
        min( 1f, color.a )
      );
    }
` );
};