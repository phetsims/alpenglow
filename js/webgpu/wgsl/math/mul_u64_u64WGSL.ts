// Copyright 2024, University of Colorado Boulder

/**
 * Multiplies two u64s together, returning a u64 (the low 64 bits of the result)
 *
 * TODO: karatsuba?
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { wgsl, WGSLExpression, WGSLStringModule } from '../WGSLString.js';
import { u64WGSL } from './u64WGSL.js';
import { mul_u32_u32_to_u64WGSL } from './mul_u32_u32_to_u64WGSL.js';
import { add_u64_u64WGSL } from './add_u64_u64WGSL.js';

export const mul_u64_u64WGSL = (
  a: WGSLExpression,
  b: WGSLExpression
): WGSLExpression => {
  // ( a_low + a_high * 2^32 ) * ( b_low + b_high * 2^32 ) mod 2^64
  // = a_low * b_low + a_low * b_high * 2^32 + a_high * b_low * 2^32 + a_high * b_high * 2^64 mod 2^64
  // = a_low * b_low + ( a_low * b_high + a_high * b_low ) * 2^32 mod 2^64
  return new WGSLStringModule( 'mul_u64_u64', wgsl`mul_u64_u64( ${a}, ${b} )`, wgsl`
    fn mul_u64_u64( a: ${u64WGSL}, b: ${u64WGSL} ) -> ${u64WGSL} {
      let low = ${mul_u32_u32_to_u64WGSL( wgsl`a.x`, wgsl`b.x` )};
      let mid0 = vec2( 0u, ${mul_u32_u32_to_u64WGSL( wgsl`a.x`, wgsl`b.y` )}.x );
      let mid1 = vec2( 0u, ${mul_u32_u32_to_u64WGSL( wgsl`a.y`, wgsl`b.x` )}.x );
      return ${add_u64_u64WGSL( add_u64_u64WGSL( wgsl`low`, wgsl`mid0` ), wgsl`mid1` )};
    }
` );
};