// Copyright 2024-2025, University of Colorado Boulder

/**
 * Adds two u32s together, returning a u64.
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import { wgsl, WGSLExpression, WGSLStringModule } from '../WGSLString.js';
import { u64WGSL } from './u64WGSL.js';

export const add_u32_u32_to_u64WGSL = (
  a: WGSLExpression,
  b: WGSLExpression
): WGSLExpression => {
  return new WGSLStringModule( 'add_u32_u32_to_u64', wgsl`add_u32_u32_to_u64( ${a}, ${b} )`, wgsl`
    fn add_u32_u32_to_u64( a: u32, b: u32 ) -> ${u64WGSL} {
      let sum = a + b;
      return vec2( sum, select( 0u, 1u, sum < a ) );
    }
` );
};