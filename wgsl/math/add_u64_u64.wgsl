// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./u64
#import ./add_u32_u32_to_u64

// ( a_low + a_high * 2^32 ) + ( b_low + b_high * 2^32 ) mod 2^64
// a_low + b_low + ( a_high + b_high ) * 2^32 mod 2^64
fn add_u64_u64( a: u64, b: u64 ) -> u64 {
  return add_u32_u32_to_u64( a.x, b.x ) + vec2( 0u, add_u32_u32_to_u64( a.y, b.y ).x );
}
