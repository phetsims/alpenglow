// Copyright 2024, University of Colorado Boulder

/**
 * Converts an i64 to a rational q128 (whole number).
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { wgsl, WGSLExpression, WGSLStringModule } from '../WGSLString.js';
import { i64WGSL } from './i64WGSL.js';
import { q128WGSL } from './q128WGSL.js';

export const whole_i64_to_q128WGSL = (
  i64: WGSLExpression,
  inline = true
): WGSLExpression => {
  if ( inline ) {
    return wgsl`vec4( ${i64}, 1u, 0u )`;
  }
  else {
    return new WGSLStringModule( 'whole_i64_to_q128', wgsl`whole_i64_to_q128( ${i64} )`, wgsl`
      fn whole_i64_to_q128( numerator: ${i64WGSL} ) -> ${q128WGSL} {
        return vec4( numerator, 1u, 0u );
      }
    ` );
  }
};