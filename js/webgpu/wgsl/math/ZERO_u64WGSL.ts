// Copyright 2024-2025, University of Colorado Boulder

/**
 * Zero constant for u64
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { wgsl, WGSLReferenceModule } from '../WGSLString.js';

export const ZERO_u64WGSL = new WGSLReferenceModule( 'ZERO_u64', wgsl`
  const ZERO_u64 = vec2( 0u, 0u );
` );