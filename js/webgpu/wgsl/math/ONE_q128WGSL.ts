// Copyright 2024, University of Colorado Boulder

import { wgsl, WGSLReferenceModule } from '../../../imports.js';

/**
 * Zero constant for q128
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

export default new WGSLReferenceModule( 'ONE_q128', wgsl`
  const ONE_q128 = vec4( 1u, 0u, 1u, 0u );
` );