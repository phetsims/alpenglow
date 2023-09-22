// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./q128
#import ./is_zero_u64
#import ./subtract_i64_i64
#import ./mul_i64_i64

// TODO: test
// Check fraction equality with cross-multiply (if we have the bits to spare to avoid reduction... reduction would also
// work).
fn equals_cross_mul_q128( a: q128, b: q128 ) -> bool {
  return is_zero_u64( subtract_i64_i64( mul_i64_i64( a.xy, b.zw ), mul_i64_i64( a.zw, b.xy ) ) );
}
