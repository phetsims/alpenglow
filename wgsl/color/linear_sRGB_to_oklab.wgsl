// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

const lsto_third = 1.0 / 3.0;

fn linear_sRGB_to_oklab( color: vec3f ) -> vec3f {
  let l = 0.4122214708 * color.r + 0.5363325363 * color.g + 0.0514459929 * color.b;
  let m = 0.2119034982 * color.r + 0.6806995451 * color.g + 0.1073969566 * color.b;
  let s = 0.0883024619 * color.r + 0.2817188376 * color.g + 0.6299787005 * color.b;

  // TODO: should we use https://www.shadertoy.com/view/wts3RX? or a faster cube-root?
  let l_ = pow( l, lsto_third );
  let m_ = pow( m, lsto_third );
  let s_ = pow( s, lsto_third );

  return vec3(
    0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
  );
}
