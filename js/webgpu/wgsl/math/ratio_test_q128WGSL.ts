// Copyright 2024-2026, University of Colorado Boulder

/**
 * Returns a range query on the rational (q128) value:
 *
 * 2i: totally internal (0<q<1)
 * 1i: on an endpoint (q=0 or q=1)
 * 0i: totally external (q<0 or q>1)
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import { wgsl, WGSLExpression, WGSLExpressionI32, WGSLStringModule } from '../WGSLString.js';
import { q128WGSL } from './q128WGSL.js';
import { cmp_i64_i64WGSL } from './cmp_i64_i64WGSL.js';
import { ZERO_u64WGSL } from './ZERO_u64WGSL.js';

export const ratio_test_q128WGSL = (
  q128: WGSLExpression
): WGSLExpressionI32 => {
  return new WGSLStringModule( 'ratio_test_q128', wgsl`ratio_test_q128( ${q128} )`, wgsl`
    fn ratio_test_q128( q: ${q128WGSL} ) -> i32 {
      return ${cmp_i64_i64WGSL( wgsl`q.xy`, ZERO_u64WGSL )} + ${cmp_i64_i64WGSL( wgsl`q.zw`, wgsl`q.xy` )};
    }
  ` );
};