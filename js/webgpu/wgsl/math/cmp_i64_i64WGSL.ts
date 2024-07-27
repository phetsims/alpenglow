// Copyright 2024, University of Colorado Boulder

import { i64WGSL, is_negative_i64WGSL, is_zero_u64WGSL, subtract_i64_i64WGSL, wgsl, WGSLExpression, WGSLExpressionI32, WGSLStringModule } from '../../../imports.js';

/**
 * Returns a comparison of two i64s:
 *
 * -1 if a < b
 * 0 if a == b
 * 1 if a > b
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

export default (
  a: WGSLExpression,
  b: WGSLExpression
): WGSLExpressionI32 => {
  return new WGSLStringModule( 'cmp_i64_i64', wgsl`cmp_i64_i64( ${a}, ${b} )`, wgsl`
    fn cmp_i64_i64( a: ${i64WGSL}, b: ${i64WGSL} ) -> i32 {
      let diff = ${subtract_i64_i64WGSL( wgsl`a`, wgsl`b` )};
      if ( ${is_zero_u64WGSL( wgsl`diff` )} ) {
        return 0i;
      }
      else {
        return select( 1i, -1i, ${is_negative_i64WGSL( wgsl`diff` )} );
      }
    }
  ` );
};