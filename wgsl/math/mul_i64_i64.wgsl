// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./i64
#import ./mul_u64_u64
#import ./abs_i64
#import ./is_negative_i64
#import ./negate_i64

fn mul_i64_i64( a: i64, b: i64 ) -> i64 {
  var result = mul_u64_u64( abs_i64( a ), abs_i64( b ) );
  result.y &= 0x7fffffffu; // remove the sign bit
  if ( is_negative_i64( a ) != is_negative_i64( b ) ) {
    return negate_i64( result );
  }
  else {
    return result;
  }
}
