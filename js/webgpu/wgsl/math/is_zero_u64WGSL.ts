// Copyright 2024-2025, University of Colorado Boulder

/**
 * Checks whether a u64 is zero
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { wgsl, WGSLExpression, WGSLStringModule } from '../WGSLString.js';
import { u64WGSL } from './u64WGSL.js';

export const is_zero_u64WGSL = (
  u64: WGSLExpression
): WGSLExpression => {
  return new WGSLStringModule( 'is_zero_u64', wgsl`is_zero_u64( ${u64} )`, wgsl`
    fn is_zero_u64( a: ${u64WGSL} ) -> bool {
      return a.x == 0u && a.y == 0u;
    }
  ` );
};