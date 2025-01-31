// Copyright 2024-2025, University of Colorado Boulder

/**
 * Checks whether an i64 is negative
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { wgsl, WGSLExpression, WGSLStringModule } from '../WGSLString.js';
import { i64WGSL } from './i64WGSL.js';

export const is_negative_i64WGSL = (
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