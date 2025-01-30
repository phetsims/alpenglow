// Copyright 2024, University of Colorado Boulder

/**
 * Maps a linear sRGB color to a color that is within the sRGB gamut, using oklab for measuring perceptual distance.
 *
 * Relative colorimetric mapping. We could add more of a perceptual intent, but this is a good start.
 *
 * NOTE: If changing this, also likely should change gamut_map_linear_displayP3
 *
 * Modeled after https://drafts.csswg.org/css-color-4/#binsearch
 *
 * See RenderColor.gamutMapLinearSRGB for more information.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { wgsl, WGSLExpression, WGSLExpressionBool, WGSLStringModule } from '../WGSLString.js';
import { is_color_in_rangeWGSL } from './is_color_in_rangeWGSL.js';
import { linear_sRGB_to_oklabWGSL } from './linear_sRGB_to_oklabWGSL.js';
import { oklab_to_linear_sRGBWGSL } from './oklab_to_linear_sRGBWGSL.js';

export const gamut_map_linear_sRGBWGSL = (
  vec3: WGSLExpression
): WGSLExpressionBool => {
  return new WGSLStringModule( 'gamut_map_linear_sRGB', wgsl`gamut_map_linear_sRGB( ${vec3} )`, wgsl`
    fn gamut_map_linear_sRGB( color: vec3f ) -> vec3f {
      if ( ${is_color_in_rangeWGSL( wgsl`color` )} ) {
        return color;
      }
    
      var oklab = ${linear_sRGB_to_oklabWGSL( wgsl`color` )};
      if ( oklab.x <= 0f ) {
        return vec3( 0f );
      }
      else if ( oklab.x >= 1f ) {
        return vec3( 1f );
      }
    
      let chroma = oklab.yz;
    
      // Bisection of chroma
      var lowChroma = 0f;
      var highChroma = 1f;
      var clipped = vec3( 0f );
    
      while ( highChroma - lowChroma > 1e-4f ) {
        let testChroma = ( lowChroma + highChroma ) * 0.5;
        oklab = vec3(
          oklab.x,
          chroma * testChroma
        );
    
        let mapped = ${oklab_to_linear_sRGBWGSL( wgsl`oklab` )};
        let isInColorRange = is_color_in_range( mapped );
        clipped = select( clamp( mapped, vec3( 0f ), vec3( 1f ) ), mapped, isInColorRange );
    
        // JND (just noticeable difference) of 0.02, per the spec at https://drafts.csswg.org/css-color/#css-gamut-mapping
        if ( isInColorRange || distance( ${linear_sRGB_to_oklabWGSL( wgsl`clipped` )}, oklab ) <= 0.02 ) {
          lowChroma = testChroma;
        }
        else {
          highChroma = testChroma;
        }
      }
    
      let potentialResult = ${oklab_to_linear_sRGBWGSL( wgsl`oklab` )};
      if ( is_color_in_range( potentialResult ) ) {
        return potentialResult;
      }
      else {
        return clipped;
      }
    }
` );
};