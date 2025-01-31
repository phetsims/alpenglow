// Copyright 2024-2025, University of Colorado Boulder

/**
 * One constant for u64
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { wgsl, WGSLReferenceModule } from '../WGSLString.js';

export const ONE_u64WGSL = new WGSLReferenceModule( 'ONE_u64', wgsl`
  const ONE_u64 = vec2( 1u, 0u );
` );