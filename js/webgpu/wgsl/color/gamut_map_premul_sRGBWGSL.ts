// Copyright 2024-2025, University of Colorado Boulder

/**
 * Converts premultiplied sRGB => sRGB, while ensuring the color is within the sRGB gamut.
 *
 * See RenderColor.gamutMapPremultipliedSRGB for more information.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { wgsl, WGSLExpression, WGSLStringModule } from '../WGSLString.js';
import { linear_sRGB_to_sRGBWGSL } from './linear_sRGB_to_sRGBWGSL.js';
import { gamut_map_linear_sRGBWGSL } from './gamut_map_linear_sRGBWGSL.js';
import { sRGB_to_linear_sRGBWGSL } from './sRGB_to_linear_sRGBWGSL.js';
import { unpremultiplyWGSL } from './unpremultiplyWGSL.js';

export const gamut_map_premul_sRGBWGSL = (
  vec4: WGSLExpression
): WGSLExpression => {
  return new WGSLStringModule( 'gamut_map_premul_sRGB', wgsl`gamut_map_premul_sRGB( ${vec4} )`, wgsl`
    fn gamut_map_premul_sRGB( color: vec4f ) -> vec4f {
      if ( color.a <= 1e-8f ) {
        return vec4( 0f );
      }
    
      return vec4(
        ${linear_sRGB_to_sRGBWGSL( gamut_map_linear_sRGBWGSL( sRGB_to_linear_sRGBWGSL( wgsl`${unpremultiplyWGSL( wgsl`color` )}.rgb` ) ) )},
        min( 1f, color.a )
      );
    }
` );
};