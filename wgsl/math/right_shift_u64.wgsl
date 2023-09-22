// Copyright 2023, University of Colorado Boulder

/**
 * TODO: signed right shift?
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./u64

fn right_shift_u64( a: u64, b: u32 ) -> u64 {
  if ( b == 0u ) {
    return a;
  }
  else if ( b < 32u ) {
    return vec2( ( a.x >> b ) | ( a.y << ( 32u - b ) ), a.y >> b );
  }
  else {
    return vec2( a.y >> ( b - 32u ), 0u );
  }
}
