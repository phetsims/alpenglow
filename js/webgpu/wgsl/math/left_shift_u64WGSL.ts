// Copyright 2024, University of Colorado Boulder

import { u64WGSL, wgsl, WGSLExpression, WGSLExpressionU32, WGSLStringModule } from '../../../imports.js';

/**
 * Left-shifts a u64 by a u32.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

export default (
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