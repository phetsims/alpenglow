// Copyright 2024-2026, University of Colorado Boulder

/**
 * Alias for u64, which is not yet supported in WGSL.
 *
 * Unsigned integer, v.x being the lower 32 bits and v.y being the upper 32 bits.
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import { wgsl, WGSLReferenceModule } from '../WGSLString.js';

export const u64WGSL = new WGSLReferenceModule( 'u64', wgsl`
  alias u64 = vec2<u32>;
` );