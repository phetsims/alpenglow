// Copyright 2024-2025, University of Colorado Boulder

/**
 * Converts a u32 to a u64.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { wgsl, WGSLExpression, WGSLExpressionU32, WGSLStringModule } from '../WGSLString.js';
import { u64WGSL } from './u64WGSL.js';

export const u32_to_u64WGSL = (
  u32: WGSLExpressionU32,
  inline = true
): WGSLExpression => {
  if ( inline ) {
    return wgsl`vec2<u32>( ${u32}, 0u )`;
  }
  else {
    return new WGSLStringModule( 'u32_to_u64', wgsl`u32_to_u64( ${u32} )`, wgsl`
      fn u32_to_u64( x: u32 ) -> ${u64WGSL} {
        return vec2<u32>( x, 0u );
      }
    ` );
  }
};