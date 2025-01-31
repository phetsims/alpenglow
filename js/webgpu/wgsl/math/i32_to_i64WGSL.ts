// Copyright 2024-2025, University of Colorado Boulder

/**
 * Converts an i32 to an i64.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { wgsl, WGSLExpression, WGSLExpressionI32, WGSLStringModule } from '../WGSLString.js';
import { i64WGSL } from './i64WGSL.js';

export const i32_to_i64WGSL = (
  i64: WGSLExpressionI32
): WGSLExpression => {
  return new WGSLStringModule( 'i32_to_i64', wgsl`i32_to_i64( ${i64} )`, wgsl`
    fn i32_to_i64( x: i32 ) -> ${i64WGSL} {
      return vec2<u32>( u32( x ), select( 0u, 0xffffffffu, x < 0i ) );
    }
` );
};