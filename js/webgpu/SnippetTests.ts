// Copyright 2023, University of Colorado Boulder

/**
 * Assorted WGSL snippet tests
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { DualSnippet, wgsl_intersect_line_segments, wgsl_mul_u32_u32_to_u64 } from '../imports.js';

QUnit.module( 'Snippet' );

QUnit.test( 'wgsl_mul_u32_u32_to_u64 exists', assert => {
  assert.ok( wgsl_mul_u32_u32_to_u64 );
} );

QUnit.test( 'intersect_line_segments snippet', assert => {
  const snippet = DualSnippet.fromSource( wgsl_intersect_line_segments );
  assert.ok( snippet );
} );
