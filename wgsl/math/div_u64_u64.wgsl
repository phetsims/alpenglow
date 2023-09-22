// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./u64
#import ./first_leading_bit_u64
#import ./left_shift_u64
#import ./is_zero_u64
#import ./cmp_u64_u64
#import ./subtract_i64_i64
#import ./right_shift_u64

// Packed quotient, remainder
// See https://stackoverflow.com/questions/18448343/divdi3-division-used-for-long-long-by-gcc-on-x86
// and https://stackoverflow.com/questions/11548070/x86-64-big-integer-representation/18202791#18202791
// TODO: eeek, will this work, we're using our signed subtraction on unsigned where we guarantee the top bit
// TODO: could optimize the left shift
// TODO: omg, are we going to overflow?
// TODO: we can ignore division with https://en.wikipedia.org/wiki/Binary_GCD_algorithm perhaps?
fn div_u64_u64( a: u64, b: u64 ) -> vec4<u32> {
  if ( is_zero_u64( a ) ) {
    return vec4( 0u, 0u, 0u, 0u );
  }
  else if ( is_zero_u64( b ) ) {
    // TODO: HOW to better complain loudly? OR do we just not check, because we should have checked before?
    return vec4( 0u, 0u, 0u, 0u );
  }
  var result = vec2( 0u, 0u );
  var remainder = a;

  let high_bit = min( first_leading_bit_u64( a ), first_leading_bit_u64( b ) );
  var count = 63u - high_bit;
  var divisor = left_shift_u64( b, count );

  while( !is_zero_u64( remainder ) ) {
    if ( cmp_u64_u64( remainder, divisor ) >= 0i ) {
      remainder = subtract_i64_i64( remainder, divisor );
      result = result | left_shift_u64( vec2( 1u, 0u ), count );
    }
    if ( count == 0u ) {
      break;
    }
    divisor = right_shift_u64( divisor, 1u );
    count -= 1u;
  }

  return vec4( result, remainder );
}
