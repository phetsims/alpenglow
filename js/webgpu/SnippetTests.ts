// Copyright 2023, University of Colorado Boulder

/**
 * Assorted WGSL snippet tests
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { mul_u32_u32_to_u64 } from '../imports.js';

QUnit.module( 'Snippet' );

QUnit.test( 'mul example', assert => {
  assert.ok( mul_u32_u32_to_u64 );
} );
