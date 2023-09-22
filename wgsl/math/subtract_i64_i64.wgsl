// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./i64
#import ./add_i64_i64
#import ./negate_i64

fn subtract_i64_i64( a: i64, b: i64 ) -> i64 {
  return add_i64_i64( a, negate_i64( b ) );
}
