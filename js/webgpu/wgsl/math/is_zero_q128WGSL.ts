// Copyright 2024, University of Colorado Boulder

import { q128WGSL, wgsl, WGSLExpression, WGSLStringModule } from '../../../imports.js';

/**
 * Checks whether a q128 (rational) is zero
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

export default (
  q128: WGSLExpression
): WGSLExpression => {
  return new WGSLStringModule( 'is_zero_q128', wgsl`is_zero_q128( ${q128} )`, wgsl`
    fn is_zero_q128( a: ${q128WGSL} ) -> bool {
      return a.x == 0u && a.y == 0u;
    }
  ` );
};