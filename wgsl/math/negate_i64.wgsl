// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./i64
#import ./add_u64_u64

fn negate_i64( a: i64 ) -> i64 {
  return add_u64_u64( ~a, vec2( 1u, 0u ) );
}
