// Copyright 2024, University of Colorado Boulder

import { cmp_i64_i64WGSL, q128WGSL, wgsl, WGSLExpression, WGSLExpressionI32, WGSLStringModule, ZERO_u64WGSL } from '../../../imports.js';

/**
 * Returns a range query on the rational (q128) value:
 *
 * 2i: totally internal (0<q<1)
 * 1i: on an endpoint (q=0 or q=1)
 * 0i: totally external (q<0 or q>1)
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

export default (
  q128: WGSLExpression
): WGSLExpressionI32 => {
  return new WGSLStringModule( 'ratio_test_q128', wgsl`ratio_test_q128( ${q128} )`, wgsl`
    fn ratio_test_q128( q: ${q128WGSL} ) -> i32 {
      return ${cmp_i64_i64WGSL( wgsl`q.xy`, ZERO_u64WGSL )} + ${cmp_i64_i64WGSL( wgsl`q.zw`, wgsl`q.xy` )};
    }
  ` );
};