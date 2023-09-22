// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

fn unpremultiply( color: vec4f ) -> vec4f {
  // Max with a small epsilon to avoid NaNs
  let a_inv = 1.0 / max( color.a, 1e-6 );

  return vec4( color.rgb * a_inv, color.a );
}
