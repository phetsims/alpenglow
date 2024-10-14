// Copyright 2023-2024, University of Colorado Boulder

/**
 * Testing for CAG
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import Bounds2 from '../../../dot/js/Bounds2.js';
import { PolygonalBoolean, PolygonalFace, RenderPath } from '../imports.js';

QUnit.module( 'PolygonalBoolean' );

QUnit.test( 'union area', assert => {
  const a = RenderPath.fromBounds( new Bounds2( 0, 0, 1, 1 ) );
  const b = RenderPath.fromBounds( new Bounds2( 0.5, 0.5, 1.5, 1.5 ) );
  const union = PolygonalBoolean.union( a, b );
  const expectedArea = 1.75;
  const actualArea = new PolygonalFace( union ).getArea();
  assert.ok( Math.abs( expectedArea - actualArea ) < 1e-6, 'union area' );
} );

QUnit.test( 'intersection area', assert => {
  const a = RenderPath.fromBounds( new Bounds2( 0, 0, 1, 1 ) );
  const b = RenderPath.fromBounds( new Bounds2( 0.5, 0.5, 1.5, 1.5 ) );
  const intersection = PolygonalBoolean.intersection( a, b );
  const expectedArea = 0.25;
  const actualArea = new PolygonalFace( intersection ).getArea();
  assert.ok( Math.abs( expectedArea - actualArea ) < 1e-6, 'intersection area' );
} );

QUnit.test( 'difference area', assert => {
  const a = RenderPath.fromBounds( new Bounds2( 0, 0, 1, 1 ) );
  const b = RenderPath.fromBounds( new Bounds2( 0.5, 0.5, 1.5, 1.5 ) );
  const difference = PolygonalBoolean.difference( a, b );
  const expectedArea = 0.75;
  const actualArea = new PolygonalFace( difference ).getArea();
  assert.ok( Math.abs( expectedArea - actualArea ) < 1e-6, 'difference area' );
} );

QUnit.test( 'overlaps area', assert => {
  const a = RenderPath.fromBounds( new Bounds2( 0, 0, 1, 1 ) );
  const b = RenderPath.fromBounds( new Bounds2( 0.5, 0.5, 1.5, 1.5 ) );
  const overlaps = PolygonalBoolean.getOverlaps( a, b );
  assert.ok( Math.abs( 0.25 - new PolygonalFace( overlaps.intersection ).getArea() ) < 1e-6, 'intersection area' );
  assert.ok( Math.abs( 0.75 - new PolygonalFace( overlaps.aOnly ).getArea() ) < 1e-6, 'aOnly area' );
  assert.ok( Math.abs( 0.75 - new PolygonalFace( overlaps.bOnly ).getArea() ) < 1e-6, 'bOnly area' );
} );