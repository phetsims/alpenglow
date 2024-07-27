// Copyright 2024, University of Colorado Boulder

import { i64WGSL, is_negative_i64WGSL, negate_i64WGSL, q128WGSL, wgsl, WGSLExpression, WGSLStringModule } from '../../../imports.js';

/**
 * Converts i64 numerator and denominator to a rational q128.
 *
 * Basically, we just ensure the denominator is positive (negating both if it is negative).
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

export default (
  numerator: WGSLExpression,
  denominator: WGSLExpression
): WGSLExpression => {
  return new WGSLStringModule( 'i64_to_q128', wgsl`i64_to_q128( ${numerator}, ${denominator} )`, wgsl`
    fn i64_to_q128( numerator: ${i64WGSL}, denominator: ${i64WGSL} ) -> ${q128WGSL} {
      if ( ${is_negative_i64WGSL( wgsl`denominator` )} ) {
        return vec4( ${negate_i64WGSL( wgsl`numerator` )}, ${negate_i64WGSL( wgsl`denominator` )} );
      }
      else {
        return vec4( numerator, denominator );
      }
    }
` );
};