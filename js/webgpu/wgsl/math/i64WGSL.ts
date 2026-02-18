// Copyright 2024-2026, University of Colorado Boulder

/**
 * Alias for i64, which is not yet supported in WGSL.
 *
 * Two's complement, with v.x being the lower 32 bits and v.y being the upper 32 bits.
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import { wgsl, WGSLReferenceModule } from '../WGSLString.js';

export const i64WGSL = new WGSLReferenceModule( 'i64', wgsl`
  alias i64 = vec2<u32>;
` );