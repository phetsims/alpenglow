// Copyright 2024-2026, University of Colorado Boulder

/**
 * Absolute value of an i64 (yes, it will probably just be an u64 after)
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import { wgsl, WGSLExpression, WGSLStringModule } from '../WGSLString.js';
import { i64WGSL } from './i64WGSL.js';
import { negate_i64WGSL } from './negate_i64WGSL.js';
import { is_negative_i64WGSL } from './is_negative_i64WGSL.js';

export const abs_i64WGSL = (
  i64: WGSLExpression
): WGSLExpression => {
  return new WGSLStringModule( 'abs_i64', wgsl`abs_i64( ${i64} )`, wgsl`
    fn abs_i64( a: ${i64WGSL} ) -> ${i64WGSL} {
      return select( a, ${negate_i64WGSL( wgsl`a` )}, ${is_negative_i64WGSL( wgsl`a` )} );
    }
` );
};