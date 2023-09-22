// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./is_color_in_range
#import ./linear_sRGB_to_oklab
#import ./oklab_to_linear_sRGB

/**
 * Relative colorimetric mapping. We could add more of a perceptual intent, but this is a good start.
 *
 * Modeled after https://drafts.csswg.org/css-color-4/#binsearch
 */
fn gamut_map_linear_sRGB( color: vec3f ) -> vec3f {
  if ( is_color_in_range( color ) ) {
    return color;
  }

  var oklab = linear_sRGB_to_oklab( color );
  if ( oklab.x <= 0f ) {
    return vec3( 0f );
  }
  else if ( oklab.x >= 1f ) {
    return vec3( 1f );
  }

  let chroma = oklab.yz;

  // Bisection of chroma
  var lowChroma = 0f;
  var highChroma = 1f;
  var clipped = vec3( 0f );

  while ( highChroma - lowChroma > 1e-4f ) {
    let testChroma = ( lowChroma + highChroma ) * 0.5;
    oklab = vec3(
      oklab.x,
      chroma * testChroma
    );

    let mapped = oklab_to_linear_sRGB( oklab );
    let isInColorRange = is_color_in_range( mapped );
    clipped = select( clamp( mapped, vec3( 0f ), vec3( 1f ) ), mapped, isInColorRange );

    // JND (just noticeable difference) of 0.02, per the spec at https://drafts.csswg.org/css-color/#css-gamut-mapping
    if ( isInColorRange || distance( linear_sRGB_to_oklab( clipped ), oklab ) <= 0.02 ) {
      lowChroma = testChroma;
    }
    else {
      highChroma = testChroma;
    }
  }

  let potentialResult = oklab_to_linear_sRGB( oklab );
  if ( is_color_in_range( potentialResult ) ) {
    return potentialResult;
  }
  else {
    return clipped;
  }
}
