// Copyright 2024-2026, University of Colorado Boulder

/**
 * Fast approximate cube root, see https://www.shadertoy.com/view/wts3RX
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import { wgsl, WGSLExpressionF32, WGSLStringModule } from '../WGSLString.js';

export const cbrtWGSL = (
  f32: WGSLExpressionF32
): WGSLExpressionF32 => {
  return new WGSLStringModule( 'cbrt', wgsl`cbrt( ${f32} )`, wgsl`
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
` );
};