// Copyright 2023, University of Colorado Boulder

/**
 * Testing for RenderProgram vs a simplified RenderProgram
 *
 * @author Marla Schulz (PhET Interactive Simulations)
 *
 */

import { RenderAlpha, RenderBarycentricBlend, RenderBarycentricBlendAccuracy, RenderColor } from '../imports.js';
import Vector4 from '../../../dot/js/Vector4.js';
import Vector2 from '../../../dot/js/Vector2.js';

QUnit.module( 'RenderProgram' );

const RED = new RenderColor( new Vector4( 255, 0, 0, 1 ) );
const GREEN = new RenderColor( new Vector4( 0, 255, 0, 1 ) );
const BLUE = new RenderColor( new Vector4( 0, 0, 255, 1 ) );
const TRANSPARENT = new RenderColor( new Vector4( 0, 0, 0, 0 ) );

const POINT_A = new Vector2( 1, 0 );
const POINT_B = new Vector2( 0, 0 );
const POINT_C = new Vector2( 0, 1 );

QUnit.test( 'simplified alpha', assert => {
  const alpha1 = new RenderAlpha( RED, 0.5 );
  const alpha2 = new RenderAlpha( alpha1, 0.8 );

  assert.ok( alpha2.simplified().isSimplified );

  const simplifiedProgram = alpha1.simplified();
  assert.equal( simplifiedProgram?.getName(), 'RenderColor' );
  assert.ok( simplifiedProgram?.isSimplified );
} );

QUnit.test( 'simplified barycentric blend', assert => {
  const complexBarycentriBlend = new RenderBarycentricBlend( POINT_A, POINT_B, POINT_C, RenderBarycentricBlendAccuracy.Accurate,
    RED, GREEN, BLUE );

  const singleColorBarycentricBlend = new RenderBarycentricBlend( POINT_A, POINT_B, POINT_C, RenderBarycentricBlendAccuracy.Accurate,
    RED, RED, RED );

  const transparentBarycentriBlend = new RenderBarycentricBlend( POINT_A, POINT_B, POINT_C, RenderBarycentricBlendAccuracy.Accurate,
    TRANSPARENT, TRANSPARENT, TRANSPARENT );

  assert.true( complexBarycentriBlend.simplified() === complexBarycentriBlend );
  assert.true( singleColorBarycentricBlend.simplified() === RED );
  assert.true( transparentBarycentriBlend.simplified() === RenderColor.TRANSPARENT );
} );

QUnit.skip( 'simplified barycentric perspective blend', assert => {
  //Currently the simplified functions are exactly the same for a barycentric blend and a barycentric perspective blend
} );

QUnit.skip( 'simplified path boolean', assert => {
  // I need to make a RenderPath and then define the inside and outside of the pathBoolean.
} );
//
// QUnit.skip( 'simplified linear blend', assert => {
//
// } );
//
// QUnit.skip( 'simplified linear gradient', assert => {
//
// } );
//
// QUnit.skip( 'simplified radial blend', assert => {
//
// } );
//
// QUnit.skip( 'simplified radial gradient', assert => {
//
// } );
//
// QUnit.skip( 'simplified blend compose', assert => {
//
// } );
//
// QUnit.skip( 'simplified depth short', assert => {
//  // Need more info to write test.
// } );
//
// QUnit.skip( 'simplified filter', assert => {
//
// } );
//
// QUnit.skip( 'simplified node', assert => {
//
// } );
//
// QUnit.skip( 'simplified image', assert => {
//
// } );
//
// QUnit.skip( 'simplified phong', assert => {
//
// } );