// Copyright 2024, University of Colorado Boulder

import { add_u64_u64WGSL } from '../../../imports.js';

/**
 * Adds two i64s together, returning an i64.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

// NOTE: Since we have two's complement, we can just add them together and it will work out.
export default add_u64_u64WGSL;