// Copyright 2024, University of Colorado Boulder

import { u64WGSL, wgsl, WGSLExpression, WGSLExpressionU32, WGSLStringModule } from '../../../imports.js';

/**
 * Converts a u32 to a u64.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

export default (
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