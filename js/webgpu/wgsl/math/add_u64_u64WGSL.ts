// Copyright 2024, University of Colorado Boulder

import { add_u32_u32_to_u64WGSL, u64WGSL, wgsl, WGSLExpression, WGSLStringModule } from '../../../imports.js';

/**
 * Adds two u64s together, returning a u64.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

export default (
  a: WGSLExpression,
  b: WGSLExpression
): WGSLExpression => {
  // ( a_low + a_high * 2^32 ) + ( b_low + b_high * 2^32 ) mod 2^64
  // a_low + b_low + ( a_high + b_high ) * 2^32 mod 2^64
  return new WGSLStringModule( 'add_u64_u64', wgsl`add_u64_u64( ${a}, ${b} )`, wgsl`
    fn add_u64_u64( a: u64, b: u64 ) -> ${u64WGSL} {
      return ${add_u32_u32_to_u64WGSL( wgsl`a.x`, wgsl`b.x` )} + vec2( 0u, ${add_u32_u32_to_u64WGSL( wgsl`a.y`, wgsl`b.y` )}.x );
    }
` );
};