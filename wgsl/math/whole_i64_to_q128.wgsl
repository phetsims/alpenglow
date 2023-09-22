// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./q128
#import ./i64

fn whole_i64_to_q128( numerator: i64 ) -> q128 {
  return vec4( numerator, 1u, 0u );
}
