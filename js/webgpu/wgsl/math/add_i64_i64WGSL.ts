// Copyright 2024-2025, University of Colorado Boulder

/**
 * Adds two i64s together, returning an i64.
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import { add_u64_u64WGSL } from './add_u64_u64WGSL.js';

// NOTE: Since we have two's complement, we can just add them together and it will work out.
export const add_i64_i64WGSL = add_u64_u64WGSL;