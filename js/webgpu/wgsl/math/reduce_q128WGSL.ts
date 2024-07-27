// Copyright 2024, University of Colorado Boulder

import { abs_i64WGSL, div_u64_u64WGSL, gcd_u64_u64WGSL, is_negative_i64WGSL, negate_i64WGSL, q128WGSL, wgsl, WGSLExpression, WGSLStringModule } from '../../../imports.js';

/**
 * Reduces a q128 (rational) to its simplest form.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

export default (
  q128: WGSLExpression
): WGSLExpression => {
  return new WGSLStringModule( 'reduce_q128', wgsl`reduce_q128( ${q128} )`, wgsl`
    fn reduce_q128( a: ${q128WGSL} ) -> ${q128WGSL} {
      let numerator = a.xy;
      let denominator = a.zw;
      if ( numerator.x == 0u && numerator.y == 0u ) {
        return vec4( 0u, 0u, 1u, 0u ); // 0/1
      }
      else if ( denominator.x == 1 && denominator.y == 0u ) {
        return a; // we're already reduced, x/1
      }
      let abs_numerator = ${abs_i64WGSL( wgsl`numerator` )};
      let gcd = ${gcd_u64_u64WGSL( wgsl`abs_numerator`, wgsl`denominator` )};
      if ( gcd.x == 1u && gcd.y == 0u ) {
        return a;
      }
      else {
        let reduced_numerator = ${div_u64_u64WGSL( wgsl`abs_numerator`, wgsl`gcd` )}.xy;
        let reduced_denominator = ${div_u64_u64WGSL( wgsl`denominator`, wgsl`gcd` )}.xy;
        if ( ${is_negative_i64WGSL( wgsl`numerator` )} ) {
          return vec4( ${negate_i64WGSL( wgsl`reduced_numerator` )}, reduced_denominator );
        }
        else {
          return vec4( reduced_numerator, reduced_denominator );
        }
      }
    }
` );
};