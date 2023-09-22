// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

// We only care about the color channels, not the alpha (we'll presume we aren't premultiplied)
fn is_color_in_range( color: vec3f ) -> bool {
  return all( color >= vec3( 0f ) ) && all( color <= vec3( 1f ) );
}
