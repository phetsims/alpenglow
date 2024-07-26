// Copyright 2024, University of Colorado Boulder

import { wgsl, WGSLReferenceModule } from '../../../imports.js';

/**
 * Alias for u64, which is not yet supported in WGSL.
 *
 * Unsigned integer, v.x being the lower 32 bits and v.y being the upper 32 bits.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

const u64WGSL = new WGSLReferenceModule( 'u64', wgsl`
  alias u64 = vec2<u32>;
` );
export default u64WGSL;