// Copyright 2024, University of Colorado Boulder

/**
 * Zero constant for q128
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { wgsl, WGSLReferenceModule } from '../WGSLString.js';

export const ONE_q128WGSL = new WGSLReferenceModule( 'ONE_q128', wgsl`
  const ONE_q128 = vec4( 1u, 0u, 1u, 0u );
` );