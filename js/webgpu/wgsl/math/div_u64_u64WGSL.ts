// Copyright 2024-2026, University of Colorado Boulder

/**
 * Integer division of two u64s, returning a vec4<u32> with the quotient (result.xy) and remainder (result.zw).
 *
 * Packed quotient, remainder
 * See https://stackoverflow.com/questions/18448343/divdi3-division-used-for-long-long-by-gcc-on-x86
 * and https://stackoverflow.com/questions/11548070/x86-64-big-integer-representation/18202791#18202791
 * TODO: eeek, will this work, we're using our signed subtraction on unsigned where we guarantee the top bit
 * TODO: could optimize the left shift
 * TODO: omg, are we going to overflow?
 * TODO: we can ignore division with https://en.wikipedia.org/wiki/Binary_GCD_algorithm perhaps?
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import { wgsl, WGSLExpression, WGSLStringModule } from '../WGSLString.js';
import { u64WGSL } from './u64WGSL.js';
import { is_zero_u64WGSL } from './is_zero_u64WGSL.js';
import { first_leading_bit_u64WGSL } from './first_leading_bit_u64WGSL.js';
import { left_shift_u64WGSL } from './left_shift_u64WGSL.js';
import { cmp_u64_u64WGSL } from './cmp_u64_u64WGSL.js';
import { subtract_i64_i64WGSL } from './subtract_i64_i64WGSL.js';
import { ONE_u64WGSL } from './ONE_u64WGSL.js';
import { right_shift_u64WGSL } from './right_shift_u64WGSL.js';

export const div_u64_u64WGSL = (
  a: WGSLExpression,
  b: WGSLExpression
): WGSLExpression => {
  return new WGSLStringModule( 'div_u64_u64', wgsl`div_u64_u64( ${a}, ${b} )`, wgsl`
    fn div_u64_u64( a: ${u64WGSL}, b: ${u64WGSL} ) -> vec4<u32> {
      if ( ${is_zero_u64WGSL( wgsl`a` )} ) {
        return vec4( 0u, 0u, 0u, 0u );
      }
      else if ( ${is_zero_u64WGSL( wgsl`b` )} ) {
        // TODO: HOW to better complain loudly? OR do we just not check, because we should have checked before?
        return vec4( 0u, 0u, 0u, 0u );
      }
      var result = vec2( 0u, 0u );
      var remainder = a;
    
      let high_bit = min( ${first_leading_bit_u64WGSL( wgsl`a` )}, ${first_leading_bit_u64WGSL( wgsl`b` )} );
      var count = 63u - high_bit;
      var divisor = ${left_shift_u64WGSL( wgsl`b`, wgsl`count` )};
    
      while( !${is_zero_u64WGSL( wgsl`remainder` )} ) {
        if ( ${cmp_u64_u64WGSL( wgsl`remainder`, wgsl`divisor` )} >= 0i ) {
          remainder = ${subtract_i64_i64WGSL( wgsl`remainder`, wgsl`divisor` )};
          result = result | ${left_shift_u64WGSL( ONE_u64WGSL, wgsl`count` )};
        }
        if ( count == 0u ) {
          break;
        }
        divisor = ${right_shift_u64WGSL( wgsl`divisor`, wgsl`1u` )};
        count -= 1u;
      }
    
      return vec4( result, remainder );
    }
` );
};