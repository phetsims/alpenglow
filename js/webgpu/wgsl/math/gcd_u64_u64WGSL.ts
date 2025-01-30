// Copyright 2024, University of Colorado Boulder

/**
 * Binary GCD of two u64s.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { wgsl, WGSLExpression, WGSLStringModule } from '../WGSLString.js';
import { u64WGSL } from './u64WGSL.js';
import { is_zero_u64WGSL } from './is_zero_u64WGSL.js';
import { first_trailing_bit_u64WGSL } from './first_trailing_bit_u64WGSL.js';
import { right_shift_u64WGSL } from './right_shift_u64WGSL.js';
import { cmp_u64_u64WGSL } from './cmp_u64_u64WGSL.js';
import { subtract_i64_i64WGSL } from './subtract_i64_i64WGSL.js';
import { left_shift_u64WGSL } from './left_shift_u64WGSL.js';

export const gcd_u64_u64WGSL = (
  a: WGSLExpression,
  b: WGSLExpression
): WGSLExpression => {
  return new WGSLStringModule( 'gcd_u64_u64', wgsl`gcd_u64_u64( ${a}, ${b} )`, wgsl`
    fn gcd_u64_u64( a: ${u64WGSL}, b: ${u64WGSL} ) -> ${u64WGSL} {
      if ( ${is_zero_u64WGSL( wgsl`a` )} ) {
        return b;
      }
      else if ( ${is_zero_u64WGSL( wgsl`b` )} ) {
        return a;
      }
    
      let gcd_two = ${first_trailing_bit_u64WGSL( wgsl`a | b` )};
    
      var u = ${right_shift_u64WGSL( wgsl`a`, wgsl`gcd_two` )};
      var v = ${right_shift_u64WGSL( wgsl`b`, wgsl`gcd_two` )};
    
      while ( u.x != v.x || u.y != v.y ) {
        if ( ${cmp_u64_u64WGSL( wgsl`u`, wgsl`v` )} == -1i ) {
          let t = u;
          u = v;
          v = t;
        }
    
        u = ${subtract_i64_i64WGSL( wgsl`u`, wgsl`v` )};
        u = ${right_shift_u64WGSL( wgsl`u`, first_trailing_bit_u64WGSL( wgsl`u` ) )};
      }
    
      return ${left_shift_u64WGSL( wgsl`u`, wgsl`gcd_two` )};
    }
` );
};