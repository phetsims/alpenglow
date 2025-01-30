// Copyright 2024-2025, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import Bounds2 from '../../../../../dot/js/Bounds2.js';
import Matrix3 from '../../../../../dot/js/Matrix3.js';
import Vector2 from '../../../../../dot/js/Vector2.js';
import Vector4 from '../../../../../dot/js/Vector4.js';
import { alpenglow } from '../../../alpenglow.js';
import { Rasterize } from '../../../raster/Rasterize.js';
import { convertColorSpace } from '../../../render-program/convertColorSace.js';
import { PolygonFilterType } from '../../../render-program/PolygonFilterType.js';
import { RenderColor } from '../../../render-program/RenderColor.js';
import { RenderColorSpace } from '../../../render-program/RenderColorSpace.js';
import { RenderLinearBlend } from '../../../render-program/RenderLinearBlend.js';
import { RenderPath } from '../../../render-program/RenderPath.js';
import { RenderPathBoolean } from '../../../render-program/RenderPathBoolean.js';
import { RenderStack } from '../../../render-program/RenderStack.js';
import { DeviceContext } from '../../compute/DeviceContext.js';
import { FaceRasterizer } from '../../FaceRasterizer.js';
import { testPolygonalFace } from '../testPolygonalFace.js';
import { RenderLinearBlendAccuracy } from '../../../render-program/RenderLinearBlendAccuracy.js';

export const evaluateTwoPassFaceRasterizer = async (
  deviceContext: DeviceContext
): Promise<HTMLCanvasElement> => {

  const LOOP = true;

  const rasterizer = new FaceRasterizer( {
    deviceContext: deviceContext,

    supportsGridFiltering: true,
    supportsBilinear: true,
    supportsMitchellNetravali: false
  } );

  const colorSpace = 'srgb';
  const outputSize = 1024;
  const rasterSize = Math.ceil( outputSize * window.devicePixelRatio );
  const rasterWidth = rasterSize;
  const rasterHeight = rasterSize;

  const canvas = document.createElement( 'canvas' );
  canvas.width = rasterWidth;
  canvas.height = rasterHeight;
  canvas.style.width = `${rasterWidth / window.devicePixelRatio}px`; // TODO: hopefully integral for tests
  canvas.style.height = `${rasterHeight / window.devicePixelRatio}px`;
  // canvas.style.width = `${256 * 4}px`; // TODO: hopefully integral for tests
  // canvas.style.height = `${256 * 4}px`;
  // canvas.style.imageRendering = 'pixelated';

  const canvasContext = deviceContext.getCanvasContext( canvas, colorSpace );

  let elapsedTime = 0;
  const initialTime = Date.now();

  const step = () => {
    if ( LOOP ) {
      window.requestAnimationFrame( step );

      elapsedTime = Date.now() - initialTime;
    }

    const filterType = PolygonFilterType.Bilinear;
    // const filterScale = LOOP ? randomNumbers[ index % ( randomNumbers.length ) ] : 50; // 25 box, 17 bilinear (comparison)
    const filterScale = ( 1 + Math.cos( elapsedTime / 100 ) * 0.5 ) * 30 + 1; // 25 box, 17 bilinear (comparison)
    // 50.51805795015657

    const clippableFace = testPolygonalFace;

    const mainFace = clippableFace.getTransformed( Matrix3.scaling( 0.37 ) );
    const smallerFace = clippableFace.getTransformed( Matrix3.translation( 16, 165 ).timesMatrix( Matrix3.scaling( 0.15 ) ) );

    const clientSpace = RenderColorSpace.premultipliedLinearSRGB;

    const program = new RenderStack( [
      new RenderPathBoolean(
        RenderPath.fromBounds( new Bounds2( 0, 0, 128, 256 ) ),
        convertColorSpace( new RenderColor(
          new Vector4( 0, 0, 0, 1 )
        ), RenderColorSpace.sRGB, clientSpace ),
        convertColorSpace( new RenderColor(
          new Vector4( 1, 1, 1, 1 )
        ), RenderColorSpace.sRGB, clientSpace )
      ),
      RenderPathBoolean.fromInside(
        new RenderPath( 'nonzero', smallerFace.toPolygonalFace().polygons ),
        convertColorSpace( new RenderColor(
          new Vector4( 1, 1, 1, 1 )
        ), RenderColorSpace.sRGB, clientSpace )
      ),
      RenderPathBoolean.fromInside(
        new RenderPath( 'nonzero', mainFace.toPolygonalFace().polygons ),
        convertColorSpace( new RenderLinearBlend(
          new Vector2( 1 / 256, 0 ),
          0,
          RenderLinearBlendAccuracy.Accurate,
          convertColorSpace( new RenderColor( new Vector4( 1, 0, 0, 1 ) ), RenderColorSpace.sRGB, RenderColorSpace.premultipliedOklab ),
          convertColorSpace( new RenderColor( new Vector4( 0.5, 0, 1, 1 ) ), RenderColorSpace.sRGB, RenderColorSpace.premultipliedOklab )
        ), RenderColorSpace.premultipliedOklab, clientSpace )
      )
    ] ).transformed( Matrix3.scaling( rasterSize / 256 ) );

    const renderableFaces = Rasterize.partitionRenderableFaces( program, new Bounds2( 0, 0, rasterSize, rasterSize ), {
      tileSize: 1024 * 1024 // never do tiles
    } );

    rasterizer.run( {
      renderableFaces: renderableFaces,
      canvasContext: canvasContext,
      rasterWidth: rasterWidth,
      rasterHeight: rasterHeight,
      colorSpace: colorSpace,
      filterType: filterType,
      filterScale: filterScale
    } ).catch( ( error: Error ) => {
      console.error( error );
    } );
  };

  step();

  return canvas;
};

alpenglow.register( 'evaluateTwoPassFaceRasterizer', evaluateTwoPassFaceRasterizer );