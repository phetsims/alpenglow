// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./i64
#import ./negate_i64
#import ./is_negative_i64

fn abs_i64( a: i64 ) -> i64 {
  return select( a, negate_i64( a ), is_negative_i64( a ) );
}
