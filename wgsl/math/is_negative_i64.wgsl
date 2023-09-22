// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./i64

fn is_negative_i64( a: i64 ) -> bool {
  return ( a.y >> 31u ) == 1u;
}
