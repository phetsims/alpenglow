// Copyright 2023, University of Colorado Boulder

/**
 * Testing for ClippableFaces
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { ClippableFace, PolygonalFace } from '../imports.js';
import Range from '../../../dot/js/Range.js';
import Bounds2 from '../../../dot/js/Bounds2.js';
import Vector4 from '../../../dot/js/Vector4.js';
import Vector2 from '../../../dot/js/Vector2.js';

QUnit.module( 'ClippableFace' );


const polygonalFace = new PolygonalFace( [ [
  phet.dot.v2( 0, 0 ),
  phet.dot.v2( 1, 0 ),
  phet.dot.v2( 0.3, 0.3 ),
  phet.dot.v2( 0, 1 )
], [
  phet.dot.v2( 1, 0 ),
  phet.dot.v2( 1, 1 ),
  phet.dot.v2( 0, 1 ),
  phet.dot.v2( 0.7, 0.7 )
], [
  phet.dot.v2( 0.432, 0.467 ),
  phet.dot.v2( 0.567, 0.512 ),
  phet.dot.v2( 0.529, 0.543 )
] ] );
const edgedFace = polygonalFace.toEdgedFace();
const edgedClippedFace = polygonalFace.toEdgedClippedFace( 0, 0, 1, 1 );

const testWithFaces = (
  f: ( ( face: ClippableFace ) => number | Vector2 | Vector4 | Range | Bounds2 ),
  ok: ( pass: boolean, message: string ) => void
): void => {
  const polygonalValue = f( polygonalFace );
  const edgedValue = f( edgedFace );
  const edgedClippedValue = f( edgedClippedFace );

  console.log( 'polygonal', polygonalValue );
  console.log( 'edged', edgedValue );
  console.log( 'edgedClipped', edgedClippedValue );

  if ( typeof polygonalValue === 'number' && typeof edgedValue === 'number' && typeof edgedClippedValue === 'number' ) {
    ok( Math.abs( polygonalValue - edgedValue ) < 1e-5, `polygonal vs edged ${Math.abs( polygonalValue - edgedValue )}` );
    ok( Math.abs( polygonalValue - edgedClippedValue ) < 1e-5, `polygonal vs edgedClipped ${Math.abs( polygonalValue - edgedClippedValue )}` );
  }
  else if (
    ( polygonalValue instanceof Vector2 && edgedValue instanceof Vector2 && edgedClippedValue instanceof Vector2 ) ||
    ( polygonalValue instanceof Vector4 && edgedValue instanceof Vector4 && edgedClippedValue instanceof Vector4 ) ||
    ( polygonalValue instanceof Range && edgedValue instanceof Range && edgedClippedValue instanceof Range ) ||
    ( polygonalValue instanceof Bounds2 && edgedValue instanceof Bounds2 && edgedClippedValue instanceof Bounds2 )
  ) {
    ok( polygonalValue.equalsEpsilon( edgedValue, 1e-5 ), 'polygonal vs edged' );
    ok( polygonalValue.equalsEpsilon( edgedClippedValue, 1e-5 ), 'polygonal vs edgedClipped' );
  }
};

QUnit.test( 'getBounds', assert => {
  testWithFaces( face => face.getBounds(), assert.ok.bind( assert ) );
} );

// TODO: add a lot of the tests in the playground
