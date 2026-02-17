// Copyright 2024-2025, University of Colorado Boulder

/**
 * Returns a comparison of two u64s:
 *
 * -1 if a < b
 * 0 if a == b
 * 1 if a > b
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import { wgsl, WGSLExpression, WGSLExpressionI32, WGSLStringModule } from '../WGSLString.js';
import { u64WGSL } from './u64WGSL.js';

export const cmp_u64_u64WGSL = (
  a: WGSLExpression,
  b: WGSLExpression
): WGSLExpressionI32 => {
  return new WGSLStringModule( 'cmp_u64_u64', wgsl`cmp_u64_u64( ${a}, ${b} )`, wgsl`
    fn cmp_u64_u64( a: ${u64WGSL}, b: ${u64WGSL} ) -> i32 {
      if ( a.y < b.y ) {
        return -1i;
      }
      else if ( a.y > b.y ) {
        return 1i;
      }
      else {
        if ( a.x < b.x ) {
          return -1i;
        }
        else if ( a.x > b.x ) {
          return 1i;
        }
        else {
          return 0i;
        }
      }
    }
  ` );
};