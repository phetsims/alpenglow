// Copyright 2024, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, DeviceContext, FaceRasterizer, PolygonFilterType, Rasterize, RenderColor, RenderColorSpace, RenderLinearBlend, RenderLinearBlendAccuracy, RenderPath, RenderPathBoolean, RenderStack } from '../../../imports.js';
import testPolygonalFace from '../testPolygonalFace.js';
import Bounds2 from '../../../../../dot/js/Bounds2.js';

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
    const filterScale = LOOP ? ( 1 + Math.cos( elapsedTime / 100 ) * 0.5 ) * 30 + 1 : 50; // 25 box, 17 bilinear (comparison)

    const clippableFace = testPolygonalFace;

    const mainFace = clippableFace.getTransformed( phet.dot.Matrix3.scaling( 0.37 ) );
    const smallerFace = clippableFace.getTransformed( phet.dot.Matrix3.translation( 16, 165 ).timesMatrix( phet.dot.Matrix3.scaling( 0.15 ) ) );

    const clientSpace = RenderColorSpace.premultipliedLinearSRGB;

    const program = new RenderStack( [
      new RenderPathBoolean(
        RenderPath.fromBounds( new phet.dot.Bounds2( 0, 0, 128, 256 ) ),
        new RenderColor(
          new phet.dot.Vector4( 0, 0, 0, 1 )
        ).colorConverted( RenderColorSpace.sRGB, clientSpace ),
        new RenderColor(
          new phet.dot.Vector4( 1, 1, 1, 1 )
        ).colorConverted( RenderColorSpace.sRGB, clientSpace )
      ),
      RenderPathBoolean.fromInside(
        new RenderPath( 'nonzero', smallerFace.toPolygonalFace().polygons ),
        new RenderColor(
          new phet.dot.Vector4( 1, 1, 1, 1 )
        ).colorConverted( RenderColorSpace.sRGB, clientSpace )
      ),
      RenderPathBoolean.fromInside(
        new RenderPath( 'nonzero', mainFace.toPolygonalFace().polygons ),
        new RenderLinearBlend(
          new phet.dot.Vector2( 1 / 256, 0 ),
          0,
          RenderLinearBlendAccuracy.Accurate,
          new RenderColor( new phet.dot.Vector4( 1, 0, 0, 1 ) ).colorConverted( RenderColorSpace.sRGB, RenderColorSpace.premultipliedOklab ),
          new RenderColor( new phet.dot.Vector4( 0.5, 0, 1, 1 ) ).colorConverted( RenderColorSpace.sRGB, RenderColorSpace.premultipliedOklab )
        ).colorConverted( RenderColorSpace.premultipliedOklab, clientSpace )
      )
    ] ).transformed( phet.dot.Matrix3.scaling( rasterSize / 256 ) );

    const renderableFaces = Rasterize.partitionRenderableFaces( program, new Bounds2( 0, 0, rasterSize, rasterSize ), {
      tileSize: 1024 * 1024 // never do tiles
    } );

    rasterizer.runRenderProgram( program, {
      renderableFaces: renderableFaces,
      canvasContext: canvasContext,
      rasterWidth: rasterWidth,
      rasterHeight: rasterHeight,
      colorSpace: colorSpace,
      filterType: filterType,
      filterScale: filterScale
    }, {} ).catch( ( error: Error ) => {
      console.error( error );
    } );
  };

  step();

  return canvas;
};

alpenglow.register( 'evaluateTwoPassFaceRasterizer', evaluateTwoPassFaceRasterizer );