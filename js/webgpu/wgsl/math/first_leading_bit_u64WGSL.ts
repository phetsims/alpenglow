// Copyright 2024, University of Colorado Boulder

import { u64WGSL, wgsl, WGSLExpression, WGSLExpressionU32, WGSLStringModule } from '../../../imports.js';

/**
 * Returns the position of the first leading bit (most significant bit) in a u64.
 *
 * NOTE: ASSUMES NONZERO
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

export default (
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