// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

fn premultiply( color: vec4f ) -> vec4f {
  return vec4( color.xyz * color.w, color.w );
}
