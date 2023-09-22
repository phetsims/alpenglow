// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./q128

fn is_zero_q128( a: q128 ) -> bool {
  return a.x == 0u && a.y == 0u;
}
