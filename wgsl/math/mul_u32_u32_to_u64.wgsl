// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./u64
#import ./add_u32_u32_to_u64

// ( a_low + a_high * 2^16 ) * ( b_low + b_high * 2^16 )
// ( a_low * b_low ) + ( a_low * b_high + a_high * b_low ) * 2^16 + ( a_high * b_high ) * 2^32
fn mul_u32_u32_to_u64( a: u32, b: u32 ) -> u64 {
  let a_low = a & 0xffffu;
  let a_high = a >> 16u;
  let b_low = b & 0xffffu;
  let b_high = b >> 16u;
  let c_low = a_low * b_low;
  let c_mid = a_low * b_high + a_high * b_low;
  let c_high = a_high * b_high;
  let low = add_u32_u32_to_u64( c_low, c_mid << 16u );
  let high = vec2( 0u, ( c_mid >> 16u ) + c_high );
  return low + high;
}
