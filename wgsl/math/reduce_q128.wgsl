// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./q128
#import ./gcd_u64_u64
#import ./abs_i64
#import ./div_u64_u64
#import ./is_negative_i64
#import ./negate_i64

fn reduce_q128( a: q128 ) -> q128 {
  let numerator = a.xy;
  let denominator = a.zw;
  if ( numerator.x == 0u && numerator.y == 0u ) {
    return vec4( 0u, 0u, 1u, 0u ); // 0/1
  }
  else if ( denominator.x == 1 && denominator.y == 0u ) {
    return a; // we're already reduced, x/1
  }
  let abs_numerator = abs_i64( numerator );
  let gcd = gcd_u64_u64( abs_numerator, denominator );
  if ( gcd.x == 1u && gcd.y == 0u ) {
    return a;
  }
  else {
    let reduced_numerator = div_u64_u64( abs_numerator, gcd ).xy;
    let reduced_denominator = div_u64_u64( denominator, gcd ).xy;
    if ( is_negative_i64( numerator ) ) {
      return vec4( negate_i64( reduced_numerator ), reduced_denominator );
    }
    else {
      return vec4( reduced_numerator, reduced_denominator );
    }
  }
}
