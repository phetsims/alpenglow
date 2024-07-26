// Copyright 2024, University of Colorado Boulder

import { wgsl, WGSLReferenceModule } from '../../../imports.js';

/**
 * Alias for q128, which is a rational number with a 64-bit (signed) numerator and a 64-bit (unsigned) denominator.
 *
 * v.xy: i64 numerator
 * v.zw: u64 denominator
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

const q128WGSL = new WGSLReferenceModule( 'q128', wgsl`
  alias q128 = vec4<u32>;
` );
export default q128WGSL;