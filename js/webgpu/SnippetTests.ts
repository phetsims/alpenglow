// Copyright 2023, University of Colorado Boulder

/**
 * Assorted WGSL snippet tests
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { wgsl_mul_u32_u32_to_u64 } from '../imports.js';

QUnit.module( 'Snippet' );

QUnit.test( 'wgsl_mul_u32_u32_to_u64 exists', assert => {
  assert.ok( wgsl_mul_u32_u32_to_u64 );
} );
