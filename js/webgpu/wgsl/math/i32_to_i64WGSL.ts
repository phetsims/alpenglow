// Copyright 2024, University of Colorado Boulder

import { i64WGSL, wgsl, WGSLExpression, WGSLExpressionI32, WGSLStringModule } from '../../../imports.js';

/**
 * Converts an i32 to an i64.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

export default (
  i64: WGSLExpressionI32
): WGSLExpression => {
  return new WGSLStringModule( 'i32_to_i64', wgsl`i32_to_i64( ${i64} )`, wgsl`
    fn i32_to_i64( x: i32 ) -> ${i64WGSL} {
      return vec2<u32>( u32( x ), select( 0u, 0xffffffffu, x < 0i ) );
    }
` );
};