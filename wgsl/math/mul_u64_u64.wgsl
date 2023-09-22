// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./u64
#import ./mul_u32_u32_to_u64
#import ./add_u64_u64

// ( a_low + a_high * 2^32 ) * ( b_low + b_high * 2^32 ) mod 2^64
// = a_low * b_low + a_low * b_high * 2^32 + a_high * b_low * 2^32 + a_high * b_high * 2^64 mod 2^64
// = a_low * b_low + ( a_low * b_high + a_high * b_low ) * 2^32 mod 2^64
fn mul_u64_u64( a: u64, b: u64 ) -> u64 {
  let low = mul_u32_u32_to_u64( a.x, b.x );
  let mid0 = vec2( 0u, mul_u32_u32_to_u64( a.x, b.y ).x );
  let mid1 = vec2( 0u, mul_u32_u32_to_u64( a.y, b.x ).x );
  return add_u64_u64( add_u64_u64( low, mid0 ), mid1 );
}
