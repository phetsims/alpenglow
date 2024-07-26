// Copyright 2024, University of Colorado Boulder

import { u64WGSL, wgsl, WGSLExpression, WGSLExpressionU32, WGSLStringModule } from '../../../imports.js';

/**
 * Right-shifts a u64 by a u32.
 *
 * TODO: signed right shift?
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

export default (
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