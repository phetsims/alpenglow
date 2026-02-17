// Copyright 2024-2025, University of Colorado Boulder

/**
 * Returns the position of the first leading bit (most significant bit) in a u64.
 *
 * NOTE: ASSUMES NONZERO
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import { wgsl, WGSLExpression, WGSLExpressionU32, WGSLStringModule } from '../WGSLString.js';
import { u64WGSL } from './u64WGSL.js';

export const first_leading_bit_u64WGSL = (
  u64: WGSLExpression
): WGSLExpressionU32 => {
  return new WGSLStringModule( 'first_leading_bit_u64', wgsl`first_leading_bit_u64( ${u64} )`, wgsl`
    fn first_leading_bit_u64( a: ${u64WGSL} ) -> u32 {
      if ( a.y != 0u ) {
        return firstLeadingBit( a.y ) + 32u;
      }
      else {
        return firstLeadingBit( a.x );
      }
    }
` );
};