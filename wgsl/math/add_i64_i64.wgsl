// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./i64
#import ./add_u64_u64

fn add_i64_i64( a: i64, b: i64 ) -> i64 {
  return add_u64_u64( a, b );
}
