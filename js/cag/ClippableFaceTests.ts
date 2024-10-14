// Copyright 2023-2024, University of Colorado Boulder

/**
 * Testing for ClippableFaces
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import Bounds2 from '../../../dot/js/Bounds2.js';
import Matrix3 from '../../../dot/js/Matrix3.js';
import Range from '../../../dot/js/Range.js';
import Vector2 from '../../../dot/js/Vector2.js';
import Vector4 from '../../../dot/js/Vector4.js';
import { ClippableFace, PolygonalFace } from '../imports.js';

QUnit.module( 'ClippableFace' );

const polygonalFace = new PolygonalFace( [ [
  new Vector2( 0, 0 ),
  new Vector2( 1, 0 ),
  new Vector2( 0.3, 0.3 ),
  new Vector2( 0, 1 )
], [
  new Vector2( 1, 0 ),
  new Vector2( 1, 1 ),
  new Vector2( 0, 1 ),
  new Vector2( 0.7, 0.7 )
], [
  new Vector2( 0.432, 0.467 ),
  new Vector2( 0.567, 0.512 ),
  new Vector2( 0.529, 0.543 )
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


QUnit.test( 'getDotRange', assert => {
  testWithFaces( f => f.getDotRange( new Vector2( 0.32, 0.95 ).normalized() ), assert.ok.bind( assert ) );
} );

QUnit.test( 'getDistanceRangeToEdges', assert => {
  testWithFaces( f => f.getDistanceRangeToEdges( new Vector2( 0.5, 0.5 ) ), assert.ok.bind( assert ) );
} );

QUnit.test( 'getDistanceRangeToInside', assert => {
  testWithFaces( f => f.getDistanceRangeToInside( new Vector2( -0.5, 0.5 ) ), assert.ok.bind( assert ) );
} );

QUnit.test( 'getArea', assert => {
  testWithFaces( f => f.getArea(), assert.ok.bind( assert ) );
} );

QUnit.test( 'getCentroid', assert => {
  testWithFaces( f => f.getCentroid( f.getArea() ), assert.ok.bind( assert ) );
} );

QUnit.test( 'getCentroidPartial', assert => {
  testWithFaces( f => f.getCentroidPartial(), assert.ok.bind( assert ) );
} );

QUnit.test( 'getZero', assert => {
  testWithFaces( f => f.getZero(), assert.ok.bind( assert ) );
} );

QUnit.test( 'getAverageDistance', assert => {
  testWithFaces( f => f.getAverageDistance( new Vector2( 0.1, 0.2 ), f.getArea() ), assert.ok.bind( assert ) );
} );

QUnit.test( 'getAverageDistanceTransformedToOrigin', assert => {
  testWithFaces( f => f.getAverageDistanceTransformedToOrigin( Matrix3.rotation2( 0.2 ), f.getArea() ), assert.ok.bind( assert ) );
} );

QUnit.test( 'getTransformed area', assert => {
  testWithFaces( f => f.getTransformed( Matrix3.rotation2( 0.2 ) ).getArea(), assert.ok.bind( assert ) );
} );

QUnit.test( 'getRounded area', assert => {
  testWithFaces( f => f.getRounded( 0.1 ).getArea(), assert.ok.bind( assert ) );
} );

QUnit.test( 'getClipped area', assert => {
  testWithFaces( f => f.getClipped( 0.1, 0.1, 0.9, 0.9 ).getArea(), assert.ok.bind( assert ) );
} );

QUnit.test( 'getClipped getClipped area', assert => {
  testWithFaces( f => f.getClipped( -0.5, 0.1, 0.9, 0.9 ).getClipped( -0.5, 0.2, 0.9, 0.8 ).getArea(), assert.ok.bind( assert ) );
} );

QUnit.test( 'getBinaryXClip area', assert => {
  testWithFaces( f => new Vector2(
    f.getBinaryXClip( 0.4, 0.7 ).minFace.getArea(),
    f.getBinaryXClip( 0.4, 0.7 ).maxFace.getArea()
  ), assert.ok.bind( assert ) );
} );

QUnit.test( 'getBinaryYClip area', assert => {
  testWithFaces( f => new Vector2(
    f.getBinaryYClip( 0.4, 0.7 ).minFace.getArea(),
    f.getBinaryYClip( 0.4, 0.7 ).maxFace.getArea()
  ), assert.ok.bind( assert ) );
} );

QUnit.test( 'getBinaryLineClip area', assert => {
  testWithFaces( f => new Vector2(
    f.getBinaryLineClip( new Vector2( 0.23, 0.94 ).normalized(), 0.4, 0.7 ).minFace.getArea(),
    f.getBinaryLineClip( new Vector2( 0.23, 0.94 ).normalized(), 0.4, 0.7 ).maxFace.getArea()
  ), assert.ok.bind( assert ) );
} );

QUnit.test( 'getStripeLineClip area', assert => {
  testWithFaces( f => new Vector4(
    f.getStripeLineClip( new Vector2( 0.23, 0.94 ).normalized(), [ 0.3, 0.5, 0.7 ], 0.7 )[ 0 ].getArea(),
    f.getStripeLineClip( new Vector2( 0.23, 0.94 ).normalized(), [ 0.3, 0.5, 0.7 ], 0.7 )[ 1 ].getArea(),
    f.getStripeLineClip( new Vector2( 0.23, 0.94 ).normalized(), [ 0.3, 0.5, 0.7 ], 0.7 )[ 2 ].getArea(),
    f.getStripeLineClip( new Vector2( 0.23, 0.94 ).normalized(), [ 0.3, 0.5, 0.7 ], 0.7 )[ 3 ].getArea()
  ), assert.ok.bind( assert ) );
} );

// TODO: gridClipIterate tests
// QUnit.test( 'gridClipIterate area', assert => {
//
// } );

QUnit.test( 'getBilinearFiltered A', assert => {
  testWithFaces( f => f.getBilinearFiltered( 0, 0, 0, 0 ), assert.ok.bind( assert ) );
} );

QUnit.test( 'getBilinearFiltered B', assert => {
  testWithFaces( f => f.getBilinearFiltered( 1, 1, 0, 0 ), assert.ok.bind( assert ) );
} );

QUnit.test( 'getMitchellNetravaliFiltered A', assert => {
  testWithFaces( f => f.getMitchellNetravaliFiltered( 0, 0, 0, 0 ), assert.ok.bind( assert ) );
} );

QUnit.test( 'getMitchellNetravaliFiltered B', assert => {
  testWithFaces( f => f.getMitchellNetravaliFiltered( 1, 1, 0, 0 ), assert.ok.bind( assert ) );
} );

QUnit.skip( 'getBinaryCircularClip area', assert => {
  testWithFaces( f => new Vector2(
    f.getBinaryCircularClip( new Vector2( 0.5, 0.5 ), 0.25, 0.1 ).insideFace.getArea(),
    f.getBinaryCircularClip( new Vector2( 0.5, 0.5 ), 0.25, 0.1 ).outsideFace.getArea()
  ), assert.ok.bind( assert ) );
} );