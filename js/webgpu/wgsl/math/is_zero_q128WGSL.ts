// Copyright 2024-2025, University of Colorado Boulder

/**
 * Checks whether a q128 (rational) is zero
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { wgsl, WGSLExpression, WGSLStringModule } from '../WGSLString.js';
import { q128WGSL } from './q128WGSL.js';

export const is_zero_q128WGSL = (
  q128: WGSLExpression
): WGSLExpression => {
  return new WGSLStringModule( 'is_zero_q128', wgsl`is_zero_q128( ${q128} )`, wgsl`
    fn is_zero_q128( a: ${q128WGSL} ) -> bool {
      return a.x == 0u && a.y == 0u;
    }
  ` );
};