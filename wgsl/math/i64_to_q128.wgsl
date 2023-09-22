// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./q128
#import ./i64
#import ./is_negative_i64
#import ./negate_i64

fn i64_to_q128( numerator: i64, denominator: i64 ) -> q128 {
  if ( is_negative_i64( denominator ) ) {
    return vec4( negate_i64( numerator ), negate_i64( denominator ) );
  }
  else {
    return vec4( numerator, denominator );
  }
}
