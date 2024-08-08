// Copyright 2024, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BlitShader, BufferArraySlot, BufferSlot, ByteEncoder, CompositeModule, DeviceContext, getArrayType, LinearEdge, LinearEdgeType, PolygonFilterType, Procedure, Rasterize, RenderColor, RenderColorSpace, RenderInstruction, RenderLinearBlend, RenderLinearBlendAccuracy, RenderPath, RenderPathBoolean, RenderStack, Routine, TextureViewResource, TextureViewSlot, TwoPassCoarseRenderableFace, TwoPassCoarseRenderableFaceType, TwoPassConfig, TwoPassConfigType, TwoPassModule, U32Type } from '../../../imports.js';
import testPolygonalFace from '../testPolygonalFace.js';
import Bounds2 from '../../../../../dot/js/Bounds2.js';

export const evaluateTwoPassFineDual = async (
  name: string,
  deviceContext: DeviceContext
): Promise<HTMLCanvasElement> => {

  const filterType = PolygonFilterType.Bilinear;
  const filterScale = 1; // 25 box, 17 bilinear (comparison)
  const supportsGridFiltering = true;
  const supportsBilinear = true;
  const supportsMitchellNetravali = false;

  const filterRadius = {
    [ PolygonFilterType.Box ]: 0.5,
    [ PolygonFilterType.Bilinear ]: 1,
    [ PolygonFilterType.MitchellNetravali ]: 2
  }[ filterType ] * filterScale;

  const filterExpansion = filterRadius - 0.5; // since our "bounds" already include a radius of 0.5 from the pixel centers

  const outputSize = 256;
  const rasterSize = Math.ceil( outputSize * window.devicePixelRatio );
  const rasterWidth = rasterSize;
  const rasterHeight = rasterSize;

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

  } );

  const binSize = ( supportsGridFiltering && filterScale === 1 ) ? {
    [ PolygonFilterType.Box ]: 16,
    [ PolygonFilterType.Bilinear ]: 15,
    [ PolygonFilterType.MitchellNetravali ]: 13
  }[ filterType ] : 16;
  // const binSize = 16; // TODO: don't fix at 16 forever for filtering
  const tileSize = 16 * binSize;

  const tileWidth = Math.ceil( rasterWidth / tileSize );
  const tileHeight = Math.ceil( rasterHeight / tileSize );

  const binWidth = Math.ceil( rasterWidth / binSize );
  const binHeight = Math.ceil( rasterHeight / binSize );

  const numBins = 256 * tileWidth * tileHeight;

  const coarseRenderableFaces: TwoPassCoarseRenderableFace[] = [];
  const coarseEdges: LinearEdge[] = [];
  const instructionsEncoder = new ByteEncoder();

  for ( const renderableFace of renderableFaces ) {

    // TODO: remove debugging note
    // if ( renderableFaces.indexOf( renderableFace ) !== 2 ) {
    //   continue;
    // }

    const face = renderableFace.face;
    const bounds = face.getBounds();
    const edgeClippedFace = face.toEdgedClippedFaceWithoutCheck( bounds.minX, bounds.minY, bounds.maxX, bounds.maxY );

    const renderProgramIndex = instructionsEncoder.byteLength / 4;

    const instructions: RenderInstruction[] = [];
    renderableFace.renderProgram.writeInstructions( instructions );
    RenderInstruction.instructionsToBinary( instructionsEncoder, instructions );

    const needsCentroid = renderableFace.renderProgram.needsCentroid;
    const needsFace = renderableFace.renderProgram.needsFace;
    const isConstant = renderableFace.renderProgram instanceof RenderColor;

    for ( let tileX = 0; tileX < tileWidth; tileX++ ) {
      for ( let tileY = 0; tileY < tileHeight; tileY++ ) {
        const minX = tileX * tileSize - filterExpansion;
        const minY = tileY * tileSize - filterExpansion;
        const maxX = ( tileX + 1 ) * tileSize + filterExpansion;
        const maxY = ( tileY + 1 ) * tileSize + filterExpansion;

        if ( renderableFace.bounds.intersectsBounds( new Bounds2( minX, minY, maxX, maxY ) ) ) {
          const maxArea = ( maxX - minX ) * ( maxY - minY );

          const face = edgeClippedFace.getClipped( minX, minY, maxX, maxY );
          if ( face.getArea() > 1e-4 ) {
            const tileIndex = tileX + tileY * tileWidth;

            if ( face.getArea() + 1e-6 >= maxArea ) {
              coarseRenderableFaces.push( {
                renderProgramIndex: renderProgramIndex,
                needsCentroid: needsCentroid,
                needsFace: needsFace,
                isConstant: isConstant,
                isFullArea: true,
                edgesIndex: 0,
                numEdges: 0,
                minXCount: 0,
                minYCount: 0,
                maxXCount: 0,
                maxYCount: 0,
                tileIndex: tileIndex
              } );
            }
            else {
              const edgesIndex = coarseEdges.length;
              const numEdges = face.edges.length;
              coarseEdges.push( ...face.edges );

              coarseRenderableFaces.push( {
                renderProgramIndex: renderProgramIndex,
                needsCentroid: needsCentroid,
                needsFace: needsFace,
                isConstant: isConstant,
                isFullArea: false,
                edgesIndex: edgesIndex,
                numEdges: numEdges,
                minXCount: face.minXCount,
                minYCount: face.minYCount,
                maxXCount: face.maxXCount,
                maxYCount: face.maxYCount,
                tileIndex: tileIndex
              } );
            }
          }
        }
      }
    }
  }

  // TODO: get the typing so we don't need to do this
  const renderProgramInstructions = [ ...instructionsEncoder.u32Array ];

  const configSlot = new BufferSlot( TwoPassConfigType );
  const coarseRenderableFacesSlot = new BufferArraySlot( getArrayType( TwoPassCoarseRenderableFaceType, coarseRenderableFaces.length ) ); // TODO: variable size
  const coarseEdgesSlot = new BufferArraySlot( getArrayType( LinearEdgeType, coarseEdges.length ) ); // TODO: variable size
  const renderProgramInstructionsSlot = new BufferArraySlot( getArrayType( U32Type, renderProgramInstructions.length ) ); // TODO: variable size
  const outputSlot = new TextureViewSlot();

  const mainModule = new TwoPassModule( {
    name: `module_${name}`,

    config: configSlot,
    coarseRenderableFaces: coarseRenderableFacesSlot,
    coarseEdges: coarseEdgesSlot,
    renderProgramInstructions: renderProgramInstructionsSlot,
    output: outputSlot,
    storageFormat: deviceContext.preferredStorageFormat, // e.g. deviceContext.preferredStorageFormat
    mainTwoPassFineModuleOptions: {
      supportsGridFiltering: supportsGridFiltering,
      supportsBilinear: supportsBilinear,
      supportsMitchellNetravali: supportsMitchellNetravali
    }
  } );

  // Pick the opposite of the storage format, in case we can't write to it directly, and need to blit it over
  const potentialBlitFormat = deviceContext.preferredStorageFormat === 'bgra8unorm' ? 'rgba8unorm' : 'bgra8unorm';
  const blitShader = new BlitShader( deviceContext.device, potentialBlitFormat );
  const wrapBlitModule = new CompositeModule( [ mainModule ], ( context, data: { numBins: number; numCoarseRenderableFaces: number; textureBlit: [ GPUTextureView, GPUTextureView ] | null } ) => {
    mainModule.execute( context, {
      numBins: data.numBins,
      numCoarseRenderableFaces: data.numCoarseRenderableFaces
    } );

    if ( data.textureBlit ) {
      const encoder = context.getEncoderForCustomRender();
      blitShader.dispatch( encoder, data.textureBlit[ 1 ], data.textureBlit[ 0 ] );
    }
  } );

  const routine = await Routine.create(
    deviceContext,
    wrapBlitModule,
    [ configSlot, coarseRenderableFacesSlot, coarseEdgesSlot, renderProgramInstructionsSlot ],
    Routine.INDIVIDUAL_LAYOUT_STRATEGY,
    ( context, execute, input: {
      config: TwoPassConfig;
      coarseRenderableFaces: TwoPassCoarseRenderableFace[];
      coarseEdges: LinearEdge[];
      renderProgramInstructions: number[];
      textureBlit: [ GPUTextureView, GPUTextureView ] | null;
    } ) => {
      context.setTypedBufferValue( configSlot, input.config );
      context.setTypedBufferValue( coarseRenderableFacesSlot, input.coarseRenderableFaces );
      context.setTypedBufferValue( coarseEdgesSlot, input.coarseEdges );
      context.setTypedBufferValue( renderProgramInstructionsSlot, input.renderProgramInstructions );

      execute( context, {
        numBins: numBins,
        numCoarseRenderableFaces: input.coarseRenderableFaces.length,
        textureBlit: input.textureBlit
      } );

      // TODO: do we need to wait for anything here?
      return Promise.resolve( null );
    }
  );

  const canvas = document.createElement( 'canvas' );
  canvas.width = rasterWidth;
  canvas.height = rasterHeight;
  // canvas.style.width = `${rasterWidth / window.devicePixelRatio}px`; // TODO: hopefully integral for tests
  // canvas.style.height = `${rasterHeight / window.devicePixelRatio}px`;
  canvas.style.width = `${256 * 4}px`; // TODO: hopefully integral for tests
  canvas.style.height = `${256 * 4}px`;
  canvas.style.imageRendering = 'pixelated';

  const canvasContext = deviceContext.getCanvasContext( canvas, 'srgb' );
  const canvasTexture = canvasContext.getCurrentTexture();

  const canvasTextureFormat = canvasTexture.format;
  if ( canvasTextureFormat !== 'bgra8unorm' && canvasTextureFormat !== 'rgba8unorm' ) {
    throw new Error( 'unsupported format' );
  }

  const canOutputToCanvas = canvasTextureFormat === deviceContext.preferredStorageFormat;

  let fineOutputTextureView: GPUTextureView;
  let fineOutputTexture: GPUTexture | null = null;
  const canvasTextureView = canvasTexture.createView();

  if ( canOutputToCanvas ) {
    fineOutputTextureView = canvasTextureView;
  }
  else {
    fineOutputTexture = deviceContext.device.createTexture( {
      label: 'fineOutputTexture',
      size: {
        width: canvasTexture.width,
        height: canvasTexture.height,
        depthOrArrayLayers: 1
      },
      format: deviceContext.preferredStorageFormat,
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING // see TargetTexture
    } );
    fineOutputTextureView = fineOutputTexture.createView( {
      label: 'fineOutputTextureView',
      format: deviceContext.preferredStorageFormat,
      dimension: '2d'
    } );
  }

  // TODO: how to blit-shader things over?

  const procedure = new Procedure( routine ).bindRemainingBuffers();
  procedure.bind( outputSlot, new TextureViewResource( fineOutputTextureView ) );

  await procedure.standaloneExecute( deviceContext, {
    config: {
      rasterWidth: rasterWidth,
      rasterHeight: rasterHeight,
      tileWidth: tileWidth,
      tileHeight: tileHeight,
      binWidth: binWidth,
      binHeight: binHeight,
      tileSize: tileSize,
      binSize: binSize,
      filter: filterType,
      filterScale: filterScale,
      rasterColorSpace: 0
    },
    coarseRenderableFaces: coarseRenderableFaces,
    coarseEdges: coarseEdges,
    renderProgramInstructions: renderProgramInstructions,
    textureBlit: canOutputToCanvas ? null : [ fineOutputTextureView, canvasTextureView ]
  } );

  procedure.dispose();

  return canvas;
};

alpenglow.register( 'evaluateTwoPassFineDual', evaluateTwoPassFineDual );