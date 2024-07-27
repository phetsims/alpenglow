// Copyright 2024, University of Colorado Boulder

import { wgsl, WGSLReferenceModule } from '../../../imports.js';

/**
 * Alias for i64, which is not yet supported in WGSL.
 *
 * Two's complement, with v.x being the lower 32 bits and v.y being the upper 32 bits.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

export default new WGSLReferenceModule( 'i64', wgsl`
  alias i64 = vec2<u32>;
` );