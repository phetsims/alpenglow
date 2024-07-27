// Copyright 2024, University of Colorado Boulder

import { cmp_u64_u64WGSL, first_trailing_bit_u64WGSL, is_zero_u64WGSL, left_shift_u64WGSL, right_shift_u64WGSL, subtract_i64_i64WGSL, u64WGSL, wgsl, WGSLExpression, WGSLStringModule } from '../../../imports.js';

/**
 * Binary GCD of two u64s.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

export default (
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