// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./u64

fn cmp_u64_u64( a: u64, b: u64 ) -> i32 {
  if ( a.y < b.y ) {
    return -1i;
  }
  else if ( a.y > b.y ) {
    return 1i;
  }
  else {
    if ( a.x < b.x ) {
      return -1i;
    }
    else if ( a.x > b.x ) {
      return 1i;
    }
    else {
      return 0i;
    }
  }
}
