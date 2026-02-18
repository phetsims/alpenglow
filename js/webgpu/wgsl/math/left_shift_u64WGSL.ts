// Copyright 2024-2026, University of Colorado Boulder

/**
 * Left-shifts a u64 by a u32.
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import { wgsl, WGSLExpression, WGSLExpressionU32, WGSLStringModule } from '../WGSLString.js';
import { u64WGSL } from './u64WGSL.js';

export const left_shift_u64WGSL = (
  a: WGSLExpression,
  b: WGSLExpressionU32
): WGSLExpression => {
  return new WGSLStringModule( 'left_shift_u64', wgsl`left_shift_u64( ${a}, ${b} )`, wgsl`
    fn left_shift_u64( a: ${u64WGSL}, b: u32 ) -> ${u64WGSL} {
      if ( b == 0u ) {
        return a;
      }
      else if ( b < 32u ) {
        return vec2( a.x << b, ( a.y << b ) | ( a.x >> ( 32u - b ) ) );
      }
      else {
        return vec2( 0u, a.x << ( b - 32u ) );
      }
    }
` );
};