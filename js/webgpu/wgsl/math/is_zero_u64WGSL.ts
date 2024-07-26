// Copyright 2024, University of Colorado Boulder

import { u64WGSL, wgsl, WGSLExpression, WGSLStringModule } from '../../../imports.js';

/**
 * Checks whether a u64 is zero
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

export default (
  u64: WGSLExpression
): WGSLExpression => {
  return new WGSLStringModule( 'is_zero_u64', wgsl`is_zero_u64( ${u64} )`, wgsl`
    fn is_zero_u64( a: ${u64WGSL} ) -> bool {
      return a.x == 0u && a.y == 0u;
    }
  ` );
};