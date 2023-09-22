// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./u64

fn is_zero_u64( a: u64 ) -> bool {
  return a.x == 0u && a.y == 0u;
}
