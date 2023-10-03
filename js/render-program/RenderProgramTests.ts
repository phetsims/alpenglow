// Copyright 2023, University of Colorado Boulder

/**
 * Testing for RenderProgram vs a simplified RenderProgram
 *
 * @author Marla Schulz (PhET Interactive Simulations)
 *
 */

import { RenderAlpha, RenderColor } from '../imports.js';
import Vector4 from '../../../dot/js/Vector4.js';

QUnit.module( 'RenderProgram' );

QUnit.test( 'simplified alpha', assert => {
  const color = new RenderColor( new Vector4( 245, 40, 145, 1 ) );

  const alpha1 = new RenderAlpha( color, 0.5 );
  const alpha2 = new RenderAlpha( alpha1, 0.8 );

  assert.equal( alpha2.simplified(), null );

  const simplifiedProgram = alpha1.simplified();
  assert.equal( simplifiedProgram?.getName(), 'RenderColor' );
  assert.ok( simplifiedProgram?.isSimplified );
} );
