// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./i64
#import ./subtract_i64_i64
#import ./is_zero_u64
#import ./is_negative_i64

fn cmp_i64_i64( a: i64, b: i64 ) -> i32 {
  let diff = subtract_i64_i64( a, b );
  if ( is_zero_u64( diff ) ) {
    return 0i;
  }
  else {
    return select( 1i, -1i, is_negative_i64( diff ) );
  }
}
