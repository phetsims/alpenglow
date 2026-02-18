// Copyright 2024-2026, University of Colorado Boulder

/**
 * Checks whether two rational numbers are equal (by using cross-multiplication).
 *
 * IMPORTANT NOTE: this only works if we have the bits to spare (where numerator * denominator does NOT overflow)
 * to avoid reduction. Reduction would also work.
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import { wgsl, WGSLExpression, WGSLExpressionBool, WGSLStringModule } from '../WGSLString.js';
import { q128WGSL } from './q128WGSL.js';
import { is_zero_u64WGSL } from './is_zero_u64WGSL.js';
import { subtract_i64_i64WGSL } from './subtract_i64_i64WGSL.js';
import { mul_i64_i64WGSL } from './mul_i64_i64WGSL.js';

export const equals_cross_mul_q128WGSL = (
  a: WGSLExpression,
  b: WGSLExpression
): WGSLExpressionBool => {
  return new WGSLStringModule( 'equals_cross_mul_q128', wgsl`equals_cross_mul_q128( ${a}, ${b} )`, wgsl`
    fn equals_cross_mul_q128( a: ${q128WGSL}, b: ${q128WGSL} ) -> bool {
      return ${is_zero_u64WGSL( subtract_i64_i64WGSL(
        mul_i64_i64WGSL( wgsl`a.xy`, wgsl`b.zw` ),
        mul_i64_i64WGSL( wgsl`a.zw`, wgsl`b.xy` )
      ) )};
    }
  ` );
};