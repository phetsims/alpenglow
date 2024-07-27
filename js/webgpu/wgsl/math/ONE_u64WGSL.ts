// Copyright 2024, University of Colorado Boulder

import { wgsl, WGSLReferenceModule } from '../../../imports.js';

/**
 * One constant for u64
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

export default new WGSLReferenceModule( 'ONE_u64', wgsl`
  const ONE_u64 = vec2( 1u, 0u );
` );