// Copyright 2024-2025, University of Colorado Boulder

/**
 * Right-shifts a u64 by a u32.
 *
 * TODO: signed right shift?
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import { wgsl, WGSLExpression, WGSLExpressionU32, WGSLStringModule } from '../WGSLString.js';
import { u64WGSL } from './u64WGSL.js';

export const right_shift_u64WGSL = (
  a: WGSLExpression,
  b: WGSLExpressionU32
): WGSLExpression => {
  return new WGSLStringModule( 'right_shift_u64', wgsl`right_shift_u64( ${a}, ${b} )`, wgsl`
    fn right_shift_u64( a: ${u64WGSL}, b: u32 ) -> ${u64WGSL} {
      if ( b == 0u ) {
        return a;
      }
      else if ( b < 32u ) {
        return vec2( ( a.x >> b ) | ( a.y << ( 32u - b ) ), a.y >> b );
      }
      else {
        return vec2( a.y >> ( b - 32u ), 0u );
      }
    }
` );
};