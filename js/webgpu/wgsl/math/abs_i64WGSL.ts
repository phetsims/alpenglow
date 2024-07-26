// Copyright 2024, University of Colorado Boulder

import { i64WGSL, is_negative_i64WGSL, negate_i64WGSL, wgsl, WGSLExpression, WGSLStringModule } from '../../../imports.js';

/**
 * Absolute value of an i64 (yes, it will probably just be an u64 after)
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

export default (
  i64: WGSLExpression
): WGSLExpression => {
  return new WGSLStringModule( 'abs_i64', wgsl`abs_i64( ${i64} )`, wgsl`
    fn abs_i64( a: ${i64WGSL} ) -> ${i64WGSL} {
      return select( a, ${negate_i64WGSL( wgsl`a` )}, ${is_negative_i64WGSL( wgsl`a` )} );
    }
` );
};