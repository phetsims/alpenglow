// Copyright 2024, University of Colorado Boulder

import { u64WGSL, wgsl, WGSLExpression, WGSLExpressionU32, WGSLStringModule } from '../../../imports.js';

/**
 * Returns the position of the first trailing bit (least significant bit) in a u64.
 *
 * NOTE: ASSUMES NONZERO
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

export default (
  u64: WGSLExpression
): WGSLExpressionU32 => {
  return new WGSLStringModule( 'first_trailing_bit_u64', wgsl`first_trailing_bit_u64( ${u64} )`, wgsl`
    fn first_trailing_bit_u64( a: ${u64WGSL} ) -> u32 {
      if ( a.x != 0u ) {
        return firstTrailingBit( a.x );
      }
      else {
        return firstTrailingBit( a.y ) + 32u;
      }
    }
` );
};