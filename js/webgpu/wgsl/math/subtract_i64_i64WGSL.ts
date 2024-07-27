// Copyright 2024, University of Colorado Boulder

import { add_i64_i64WGSL, i64WGSL, negate_i64WGSL, wgsl, WGSLExpression, WGSLStringModule } from '../../../imports.js';

/**
 * Subtracts two i64s together, returning an i64.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

export default (
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