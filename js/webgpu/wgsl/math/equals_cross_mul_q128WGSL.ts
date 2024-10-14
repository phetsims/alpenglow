// Copyright 2024, University of Colorado Boulder

import { is_zero_u64WGSL, mul_i64_i64WGSL, q128WGSL, subtract_i64_i64WGSL, wgsl, WGSLExpression, WGSLExpressionBool, WGSLStringModule } from '../../../imports.js';

/**
 * Checks whether two rational numbers are equal (by using cross-multiplication).
 *
 * IMPORTANT NOTE: this only works if we have the bits to spare (where numerator * denominator does NOT overflow)
 * to avoid reduction. Reduction would also work.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

export default (
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