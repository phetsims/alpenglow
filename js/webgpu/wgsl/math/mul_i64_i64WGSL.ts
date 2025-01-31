// Copyright 2024-2025, University of Colorado Boulder

/**
 * Multiplies two i64s together, returning an i64 (the low 64 bits of the result)
 *
 * TODO: karatsuba?
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { wgsl, WGSLExpression, WGSLStringModule } from '../WGSLString.js';
import { i64WGSL } from './i64WGSL.js';
import { mul_u64_u64WGSL } from './mul_u64_u64WGSL.js';
import { abs_i64WGSL } from './abs_i64WGSL.js';
import { is_negative_i64WGSL } from './is_negative_i64WGSL.js';
import { negate_i64WGSL } from './negate_i64WGSL.js';

export const mul_i64_i64WGSL = (
  a: WGSLExpression,
  b: WGSLExpression
): WGSLExpression => {
  return new WGSLStringModule( 'mul_i64_i64', wgsl`mul_i64_i64( ${a}, ${b} )`, wgsl`
    fn mul_i64_i64( a: ${i64WGSL}, b: ${i64WGSL} ) -> ${i64WGSL} {
      var result = ${mul_u64_u64WGSL( abs_i64WGSL( wgsl`a` ), abs_i64WGSL( wgsl`b` ) )};
      result.y &= 0x7fffffffu; // remove the sign bit
      if ( ${is_negative_i64WGSL( wgsl`a` )} != ${is_negative_i64WGSL( wgsl`b` )} ) {
        return ${negate_i64WGSL( wgsl`result` )};
      }
      else {
        return result;
      }
    }
` );
};