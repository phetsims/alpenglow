// Copyright 2024, University of Colorado Boulder

import { wgsl, WGSLReferenceModule } from '../../../imports.js';

/**
 * Zero constant for u64
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

const ZERO_u64WGSL = new WGSLReferenceModule( 'ZERO_u64', wgsl`
  const ZERO_u64 = vec2( 0u, 0u );
` );
export default ZERO_u64WGSL;