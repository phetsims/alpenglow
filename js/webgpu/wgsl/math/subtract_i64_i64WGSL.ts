// Copyright 2024-2025, University of Colorado Boulder

/**
 * Subtracts two i64s together, returning an i64.
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import { wgsl, WGSLExpression, WGSLStringModule } from '../WGSLString.js';
import { add_i64_i64WGSL } from './add_i64_i64WGSL.js';
import { negate_i64WGSL } from './negate_i64WGSL.js';
import { i64WGSL } from './i64WGSL.js';

export const subtract_i64_i64WGSL = (
  a: WGSLExpression,
  b: WGSLExpression,
  inline = true
): WGSLExpression => {
  if ( inline ) {
    return add_i64_i64WGSL( a, negate_i64WGSL( b ) );
  }
  else {
    return new WGSLStringModule( 'subtract_i64_i64', wgsl`subtract_i64_i64( ${a}, ${b} )`, wgsl`
      fn subtract_i64_i64( a: ${i64WGSL}, b: ${i64WGSL} ) -> ${i64WGSL} {
        return ${add_i64_i64WGSL( a, negate_i64WGSL( b ) )};
      }
    ` );
  }
};