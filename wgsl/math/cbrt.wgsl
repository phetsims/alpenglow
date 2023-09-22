// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

// See https://www.shadertoy.com/view/wts3RX
fn cbrt( x: f32 ) -> f32 {
	var y = sign( x ) * bitcast<f32>( bitcast<u32>( abs( x ) ) / 3u + 0x2a514067u );

  // newton
  y = ( 2. * y + x / ( y * y ) ) * .333333333;
  y = ( 2. * y + x / ( y * y ) ) * .333333333;

  // halley
  let y3 = y * y * y;
  y *= ( y3 + 2. * x ) / ( 2. * y3 + x );

  return y;
}
