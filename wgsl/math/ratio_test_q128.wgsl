// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./q128
#import ./cmp_i64_i64

// 2i means totally internal (0<q<1), 1i means on an endpoint (q=0 or q=1), 0i means totally external (q<0 or q>1)
fn ratio_test_q128( q: q128 ) -> i32 {
  return cmp_i64_i64( q.xy, vec2( 0u, 0u ) ) + cmp_i64_i64( q.zw, q.xy );
}
