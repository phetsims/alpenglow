// Copyright 2024-2025, University of Colorado Boulder

/**
 * Reduces a q128 (rational) to its simplest form.
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import { wgsl, WGSLExpression, WGSLStringModule } from '../WGSLString.js';
import { q128WGSL } from './q128WGSL.js';
import { abs_i64WGSL } from './abs_i64WGSL.js';
import { gcd_u64_u64WGSL } from './gcd_u64_u64WGSL.js';
import { div_u64_u64WGSL } from './div_u64_u64WGSL.js';
import { is_negative_i64WGSL } from './is_negative_i64WGSL.js';
import { negate_i64WGSL } from './negate_i64WGSL.js';

export const reduce_q128WGSL = (
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