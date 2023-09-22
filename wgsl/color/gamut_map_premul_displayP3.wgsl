// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./unpremultiply
#import ./sRGB_to_linear_sRGB
#import ./linear_sRGB_to_sRGB
#import ./gamut_map_linear_displayP3

// premul_displayP3 => displayP3
fn gamut_map_premul_displayP3( color: vec4f ) -> vec4f {
  if ( color.a <= 1e-8f ) {
    return vec4( 0f );
  }

  return vec4(
    linear_sRGB_to_sRGB( gamut_map_linear_displayP3( sRGB_to_linear_sRGB( unpremultiply( color ).rgb ) ) ),
    min( 1f, color.a )
  );
}
