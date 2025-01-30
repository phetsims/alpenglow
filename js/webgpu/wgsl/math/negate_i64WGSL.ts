// Copyright 2024, University of Colorado Boulder

/**
 * Negates an i64
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { wgsl, WGSLExpression, WGSLStringModule } from '../WGSLString.js';
import { add_u64_u64WGSL } from './add_u64_u64WGSL.js';
import { ONE_u64WGSL } from './ONE_u64WGSL.js';
import { i64WGSL } from './i64WGSL.js';

export const negate_i64WGSL = (
  i64: WGSLExpression,
  inline = true
): WGSLExpression => {
  if ( inline ) {
    return wgsl`${add_u64_u64WGSL(
      wgsl`~( ${i64} )`,
      ONE_u64WGSL
    )}`;
  }
  else {
    return new WGSLStringModule( 'negate_i64', wgsl`negate_i64( ${i64} )`, wgsl`
      fn negate_i64( a: ${i64WGSL} ) -> ${i64WGSL} {
        return ${add_u64_u64WGSL( wgsl`~a`, ONE_u64WGSL )};
      }
    ` );
  }
};