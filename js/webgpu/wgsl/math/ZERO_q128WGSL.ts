// Copyright 2024-2026, University of Colorado Boulder

/**
 * Zero constant for q128
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import { wgsl, WGSLReferenceModule } from '../WGSLString.js';

export const ZERO_q128WGSL = new WGSLReferenceModule( 'ZERO_q128', wgsl`
  const ZERO_q128 = vec4( 0u, 0u, 1u, 0u );
` );