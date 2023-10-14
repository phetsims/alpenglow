// Copyright 2023, University of Colorado Boulder

/**
 * Rasterization failure tests
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { CombinedRaster, RasterizationOptions, Rasterize, RasterLog, RenderBlendCompose, RenderColor, RenderColorSpace, RenderColorSpaceConversion, RenderExtend, RenderFromNode, RenderGradientStop, RenderPath, RenderPathBoolean, RenderProgram, RenderRadialGradient, RenderRadialGradientAccuracy } from '../imports.js';
import Vector4 from '../../../dot/js/Vector4.js';
import Vector2 from '../../../dot/js/Vector2.js';
import Matrix3 from '../../../dot/js/Matrix3.js';
import Bounds2 from '../../../dot/js/Bounds2.js';
import IntentionalAny from '../../../phet-core/js/types/IntentionalAny.js';

QUnit.module( 'Rasterize' );

QUnit.skip( 'split clip start end matches', assert => {

  const outputSize = 768 * 2;

  const colorSpace = 'srgb' as const;

  const rasterOptions = {
    colorSpace: colorSpace,
    showOutOfGamut: false
  };

  const clientColorSpace = colorSpace === 'srgb' ? RenderColorSpace.premultipliedSRGB : RenderColorSpace.premultipliedDisplayP3;

  const radialGradientAccuracy = RenderRadialGradientAccuracy.SplitAccurate;

  const rasterizeOptions: RasterizationOptions = {
    tileSize: 256,
    renderableFaceType: 'edged'
  };

  const pathB = new RenderPath( 'nonzero', [
    [
      new Vector2( 5, 5 ),
      new Vector2( 25, 5 ),
      new Vector2( 10, 10 ),
      new Vector2( 20, 20 ),
      new Vector2( 5, 15 )
    ]
  ] );
  const pathC = new RenderPath( 'nonzero', [
    [
      new Vector2( 5, -10 ),
      new Vector2( 20, -10 ),
      new Vector2( 20, 20 ),
      new Vector2( 5, 20 )
    ]
  ] );

  const toPremulClient = ( ...args: IntentionalAny ) => {
    return RenderFromNode.colorFrom( ...args ).colorConverted( RenderColorSpace.sRGB, clientColorSpace );
  };

  const bBlendColorSpace = RenderColorSpace.premultipliedOklab;
  const b = RenderColorSpaceConversion.convert( RenderPathBoolean.fromInside( pathB, new RenderRadialGradient(
    Matrix3.IDENTITY,
    new Vector2( 10, 10 ),
    0,
    new Vector2( 10, 10 ),
    5, [
      // NOTE: LEFT this gradient in sRGB because of the strong colors, perceptual interpolation might go out of gamut
      new RenderGradientStop( 0, new RenderColor( new Vector4( 1, 0, 0, 1 ) ).colorConverted( RenderColorSpace.displayP3, bBlendColorSpace ) ),
      new RenderGradientStop( 0.3333, new RenderColor( new Vector4( 0, 1, 0, 1 ) ).colorConverted( RenderColorSpace.displayP3, bBlendColorSpace ) ),
      new RenderGradientStop( 0.6666, new RenderColor( new Vector4( 0, 0, 1, 1 ) ).colorConverted( RenderColorSpace.displayP3, bBlendColorSpace ) ),
      new RenderGradientStop( 1, new RenderColor( new Vector4( 1, 0, 0, 1 ) ).colorConverted( RenderColorSpace.displayP3, bBlendColorSpace ) )
    ],
    RenderExtend.Repeat,
    radialGradientAccuracy
  ) ), bBlendColorSpace, clientColorSpace );
  const c = RenderPathBoolean.fromInside( pathC, new RenderRadialGradient(
    Matrix3.IDENTITY,
    new Vector2( 0, 0 ),
    0,
    new Vector2( 0, 0 ),
    5, [
      // NOTE: LEFT this gradient in sRGB because of the strong colors, perceptual interpolation might go out of gamut
      new RenderGradientStop( 0.2, toPremulClient( 'rgba(255,255,255,0.5)' ) ),
      new RenderGradientStop( 0.3, toPremulClient( '#FBDD49' ) ),
      new RenderGradientStop( 0.4, toPremulClient( '#FF8103' ) ),
      new RenderGradientStop( 0.5, toPremulClient( '#FF1C6A' ) ),
      new RenderGradientStop( 0.6, toPremulClient( '#E200A3' ) ),
      new RenderGradientStop( 0.7, toPremulClient( '#9B04DB' ) ),
      new RenderGradientStop( 0.8, toPremulClient( 'rgba(109,29,198,0.5)' ) ),
      new RenderGradientStop( 0.9, toPremulClient( 'rgba(255,255,255,0)' ) )
    ],
    RenderExtend.Repeat,
    radialGradientAccuracy
  ) );
  const back = toPremulClient( 128, 128, 128, 0.5 );

  const normalBlendArray = ( arr: RenderProgram[] ) => {
    let result = arr[ 0 ];
    for ( let i = 1; i < arr.length; i++ ) {
      result = new RenderBlendCompose( 0, 0, arr[ i ], result );
    }
    return result;
  };

  const bc = new RenderBlendCompose( 3, 0, b, c );
  const program = normalBlendArray( [
    back,
    bc
  ] ).transformed(
    Matrix3.scaling( outputSize / 64 )
  );

  const rasterLog = new RasterLog();
  rasterizeOptions.log = rasterLog;

  const outputBounds = new Bounds2( 0, 0, outputSize, outputSize );

  const raster = new CombinedRaster( outputSize, outputSize, rasterOptions );

  Rasterize.rasterize( program, raster, outputBounds, rasterizeOptions );

  raster.toCanvas();

  assert.expect( 0 );
} );