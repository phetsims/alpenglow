// Copyright 2023, University of Colorado Boulder

/**
 * Testing for RenderProgram vs a simplified RenderProgram
 *
 * @author Marla Schulz (PhET Interactive Simulations)
 *
 */

import { RenderAlpha, RenderBarycentricBlend, RenderBarycentricBlendAccuracy, RenderColor, RenderLinearBlend, RenderLinearBlendAccuracy, RenderPath, RenderPathBoolean } from '../imports.js';
import Vector4 from '../../../dot/js/Vector4.js';
import Vector2 from '../../../dot/js/Vector2.js';

QUnit.module( 'RenderProgram' );

const RED = new RenderColor( new Vector4( 1, 0, 0, 1 ) );
const GREEN = new RenderColor( new Vector4( 0, 1, 0, 1 ) );
const BLUE = new RenderColor( new Vector4( 0, 0, 1, 1 ) );
const TRANSPARENT = new RenderColor( new Vector4( 0, 0, 0, 0 ) );

// How do you know which point to start at? Or do you just pick?
const POINT_A = new Vector2( 1, 0 );
const POINT_B = new Vector2( 0, 0 );
const POINT_C = new Vector2( 0, 1 );
const POINT_D = new Vector2( 0.5, 0.5 );
// const POINT_E = new Vector2( 1, 1 );

const PATH_A = new RenderPath( 'nonzero', [ [ POINT_A, POINT_B, POINT_C ] ] );
// const PATH_B = new RenderPath( 'nonzero', [ [ POINT_A, POINT_B, POINT_C, POINT_D, POINT_E ] ] );
// const PATH_C = new RenderPath( 'nonzero', [ [ POINT_A, POINT_D, POINT_B, POINT_C, POINT_E ] ] );
// const PATH_D = new RenderPath( 'nonzero', [ [ POINT_A, POINT_B, POINT_D ] ] );
// const PATH_E = new RenderPath( 'nonzero', [ [ POINT_C, POINT_E, POINT_D ] ] );
const EMPTY_PATH = new RenderPath( 'nonzero', [ [ POINT_D ] ] ); // Is this an empty path?

QUnit.test( 'simplified alpha', assert => {
  const alpha1 = new RenderAlpha( RED, 0.5 );
  const alpha2 = new RenderAlpha( alpha1, 0.8 );

  assert.ok( alpha2.simplified().isSimplified );

  const simplifiedProgram = alpha1.simplified();
  assert.deepEqual( simplifiedProgram?.getName(), 'RenderColor' );
  assert.ok( simplifiedProgram?.isSimplified );
} );

QUnit.test( 'simplified barycentric blend', assert => {
  const complexBarycentriBlend = new RenderBarycentricBlend( POINT_A, POINT_B, POINT_C, RenderBarycentricBlendAccuracy.Accurate,
    RED, GREEN, BLUE );

  const singleColorBarycentricBlend = new RenderBarycentricBlend( POINT_A, POINT_B, POINT_C, RenderBarycentricBlendAccuracy.Accurate,
    RED, RED, RED );

  const transparentBarycentriBlend = new RenderBarycentricBlend( POINT_A, POINT_B, POINT_C, RenderBarycentricBlendAccuracy.Accurate,
    TRANSPARENT, TRANSPARENT, TRANSPARENT );

  assert.deepEqual( complexBarycentriBlend.simplified(), complexBarycentriBlend );
  assert.deepEqual( singleColorBarycentricBlend.simplified(), RED );
  assert.deepEqual( transparentBarycentriBlend.simplified(), RenderColor.TRANSPARENT );
} );

QUnit.skip( 'simplified barycentric perspective blend', assert => {
  //Currently the simplified functions are exactly the same for a barycentric blend and a barycentric perspective blend
} );

QUnit.test( 'simplified path boolean', assert => {

  const complexPathBoolean = new RenderPathBoolean( PATH_A, RED, GREEN );
  const simplePathBoolean = new RenderPathBoolean( PATH_A, RED, RED );
  const transparentPathBoolean = new RenderPathBoolean( PATH_A, TRANSPARENT, TRANSPARENT );
  const emptyPathBoolean = new RenderPathBoolean( EMPTY_PATH, BLUE, GREEN );

  assert.ok( complexPathBoolean.simplified().equals( complexPathBoolean ) );
  assert.ok( simplePathBoolean.simplified().equals( RED ) );
  assert.ok( transparentPathBoolean.simplified().equals( TRANSPARENT ) );
  assert.ok( emptyPathBoolean.simplified().equals( GREEN ) );
} );

QUnit.test( 'simplified linear blend', assert => {
  const complexLinearBlend = new RenderLinearBlend( new Vector2( 1, 0 ), 0, RenderLinearBlendAccuracy.Accurate, RED, GREEN );
  const simpleLinearBlend = new RenderLinearBlend( new Vector2( 1, 0 ), 0, RenderLinearBlendAccuracy.Accurate, RED, RED );
  const transparentLinearBlend = new RenderLinearBlend( new Vector2( 1, 0 ), 0, RenderLinearBlendAccuracy.Accurate, TRANSPARENT, TRANSPARENT );

  assert.ok( complexLinearBlend.simplified().equals( complexLinearBlend ) );
  assert.ok( simpleLinearBlend.simplified().equals( RED ) );
  assert.ok( transparentLinearBlend.simplified().equals( TRANSPARENT ) );
} );
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