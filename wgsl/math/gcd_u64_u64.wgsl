// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./u64
#import ./is_zero_u64
#import ./first_trailing_bit_u64
#import ./left_shift_u64
#import ./cmp_u64_u64
#import ./subtract_i64_i64
#import ./right_shift_u64

// binary GCD
fn gcd_u64_u64( a: u64, b: u64 ) -> u64 {
  if ( is_zero_u64( a ) ) {
    return b;
  }
  else if ( is_zero_u64( b ) ) {
    return a;
  }

  let gcd_two = first_trailing_bit_u64( a | b );

  var u = right_shift_u64( a, gcd_two );
  var v = right_shift_u64( b, gcd_two );

  while ( u.x != v.x || u.y != v.y ) {
    if ( cmp_u64_u64( u, v ) == -1i ) {
      let t = u;
      u = v;
      v = t;
    }

    u = subtract_i64_i64( u, v );
    u = right_shift_u64( u, first_trailing_bit_u64( u ) );
  }

  return left_shift_u64( u, gcd_two );
}
