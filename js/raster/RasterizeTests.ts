// Copyright 2023-2025, University of Colorado Boulder

/**
 * Rasterization failure tests
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import Bounds2 from '../../../dot/js/Bounds2.js';
import Matrix3 from '../../../dot/js/Matrix3.js';
import Vector2 from '../../../dot/js/Vector2.js';
import Vector4 from '../../../dot/js/Vector4.js';
import { RenderBlendCompose } from '../render-program/RenderBlendCompose.js';
import { RenderColor } from '../render-program/RenderColor.js';
import { RenderExtend } from '../render-program/RenderExtend.js';
import { RenderGradientStop } from '../render-program/RenderGradientStop.js';
import { RenderPath } from '../render-program/RenderPath.js';
import { RenderPathBoolean } from '../render-program/RenderPathBoolean.js';
import { RenderRadialGradient } from '../render-program/RenderRadialGradient.js';
import { RenderStack } from '../render-program/RenderStack.js';
import { CombinedRaster } from './CombinedRaster.js';
import { Rasterize } from './Rasterize.js';
import { RenderRadialGradientAccuracy } from '../render-program/RenderRadialGradientAccuracy.js';

QUnit.module( 'Rasterize' );

QUnit.skip( 'split clip start end matches', assert => {

  const colors = _.range( 0, 100 ).map( i => new RenderColor( new Vector4( i / 100, 0, 0, 1 ) ) );
  const outputSize = 768 * 2;

  const pathB = new RenderPath( 'nonzero', [
    [
      new Vector2( 5, 5 ),
      new Vector2( 25, 5 ),
      new Vector2( 10, 10 ),
      new Vector2( 20, 20 ),
      new Vector2( 5, 15 )
    ]
  ] );

  const program = new RenderStack( [
    colors[ 8 ],
    new RenderBlendCompose(
      3, 0,
      RenderPathBoolean.fromInside( pathB, new RenderRadialGradient(
        Matrix3.IDENTITY,
        new Vector2( 10, 10 ),
        0,
        new Vector2( 10, 10 ),
        5, [
          new RenderGradientStop( 0, colors[ 0 ] ),
          new RenderGradientStop( 0.3333, colors[ 1 ] ),
          new RenderGradientStop( 0.6666, colors[ 2 ] ),
          new RenderGradientStop( 1, colors[ 3 ] )
        ],
        RenderExtend.Repeat,
        RenderRadialGradientAccuracy.SplitAccurate
      ) ),
      colors[ 0 ]
    )
  ] ).transformed(
    Matrix3.scaling( outputSize / 64 )
  );

  const raster = new CombinedRaster( outputSize, outputSize );

  Rasterize.rasterize( program, raster, new Bounds2( 0, 0, outputSize, outputSize ), {
    tileSize: 256,
    renderableFaceType: 'edged' // forces edged faces, for the failure
  } );

  raster.toCanvas();

  assert.expect( 0 );
} );