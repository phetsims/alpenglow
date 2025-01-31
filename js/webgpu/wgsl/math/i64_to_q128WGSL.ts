// Copyright 2024-2025, University of Colorado Boulder

/**
 * Converts i64 numerator and denominator to a rational q128.
 *
 * Basically, we just ensure the denominator is positive (negating both if it is negative).
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { wgsl, WGSLExpression, WGSLStringModule } from '../WGSLString.js';
import { i64WGSL } from './i64WGSL.js';
import { q128WGSL } from './q128WGSL.js';
import { is_negative_i64WGSL } from './is_negative_i64WGSL.js';
import { negate_i64WGSL } from './negate_i64WGSL.js';

export const i64_to_q128WGSL = (
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