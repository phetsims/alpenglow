// Copyright 2024, University of Colorado Boulder

import { i64WGSL, wgsl, WGSLExpression, WGSLStringModule } from '../../../imports.js';

/**
 * Checks whether an i64 is negative
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

export default (
  i64: WGSLExpression,
  inline = true
): WGSLExpression => {
  if ( inline ) {
    return wgsl`( ( ( ${i64} ).y >> 31u ) == 1u )`;
  }
  else {
    return new WGSLStringModule( 'is_negative_i64', wgsl`is_negative_i64( ${i64} )`, wgsl`
      fn is_negative_i64( a: ${i64WGSL} ) -> bool {
        return ( a.y >> 31u ) == 1u;
      }
    ` );
  }
};