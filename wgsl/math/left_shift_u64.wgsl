// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./u64

fn left_shift_u64( a: u64, b: u32 ) -> u64 {
  if ( b == 0u ) {
    return a;
  }
  else if ( b < 32u ) {
    return vec2( a.x << b, ( a.y << b ) | ( a.x >> ( 32u - b ) ) );
  }
  else {
    return vec2( 0u, a.x << ( b - 32u ) );
  }
}
