// Copyright 2023, University of Colorado Boulder

/**
 * Testing for RenderProgram vs a simplified RenderProgram
 *
 * @author Marla Schulz (PhET Interactive Simulations)
 *
 */

import { RenderColor } from '../imports.js';
import Vector4 from '../../../dot/js/Vector4.js';

QUnit.module( 'RenderProgram' );

QUnit.test( 'color', assert => {
  const renderColorProgram = new RenderColor( new Vector4( 245, 40, 145, 0.8 ) );

  assert.equal( renderColorProgram.getName(), 'RenderColor' );
} );