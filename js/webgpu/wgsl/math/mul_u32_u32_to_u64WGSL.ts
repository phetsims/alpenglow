// Copyright 2024, University of Colorado Boulder

/**
 * Multiplies two u32s together, returning a u64.
 *
 * TODO: karatsuba multiplication
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { wgsl, WGSLExpression, WGSLStringModule } from '../WGSLString.js';
import { u64WGSL } from './u64WGSL.js';
import { add_u32_u32_to_u64WGSL } from './add_u32_u32_to_u64WGSL.js';

export const mul_u32_u32_to_u64WGSL = (
  a: WGSLExpression,
  b: WGSLExpression
): WGSLExpression => {
  // ( a_low + a_high * 2^16 ) * ( b_low + b_high * 2^16 )
  // ( a_low * b_low ) + ( a_low * b_high + a_high * b_low ) * 2^16 + ( a_high * b_high ) * 2^32
  return new WGSLStringModule( 'mul_u32_u32_to_u64', wgsl`mul_u32_u32_to_u64( ${a}, ${b} )`, wgsl`
    fn mul_u32_u32_to_u64( a: u32, b: u32 ) -> ${u64WGSL} {
      let a_low = a & 0xffffu;
      let a_high = a >> 16u;
      let b_low = b & 0xffffu;
      let b_high = b >> 16u;
      let c_low = a_low * b_low;
      let c_mid = a_low * b_high + a_high * b_low;
      let c_high = a_high * b_high;
      let low = ${add_u32_u32_to_u64WGSL( wgsl`c_low`, wgsl`c_mid << 16u` )};
      let high = vec2( 0u, ( c_mid >> 16u ) + c_high );
      return low + high;
    }
` );
};