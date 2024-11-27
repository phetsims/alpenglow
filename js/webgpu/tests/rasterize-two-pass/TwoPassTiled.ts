// Copyright 2024, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import Bounds2 from '../../../../../dot/js/Bounds2.js';
import { alpenglow, BlitShader, BufferArraySlot, BufferSlot, ByteEncoder, CompositeModule, DeviceContext, getArrayType, LinearEdge, LinearEdgeType, PolygonFilterType, Procedure, Rasterize, RenderColor, RenderColorSpace, RenderInstruction, RenderLinearBlend, RenderLinearBlendAccuracy, RenderPath, RenderPathBoolean, RenderStack, Routine, TextureViewResource, TextureViewSlot, TiledTwoPassModule, TwoPassConfig, TwoPassConfigType, TwoPassInitialRenderableFace, TwoPassInitialRenderableFaceType, u32S, U32Type } from '../../../imports.js';
import testPolygonalFace from '../testPolygonalFace.js';

export const evaluateTwoPassTiled = async (
  name: string,
  deviceContext: DeviceContext
): Promise<HTMLCanvasElement> => {

  const filterType = PolygonFilterType.Bilinear;
  const filterScale = 50 as number; // 25 box, 17 bilinear (comparison)
  const supportsGridFiltering = true;
  const supportsBilinear = true;
  const supportsMitchellNetravali = false;

  const outputSize = 1024;
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
    tileSize: 1024 * 1024 // never do tiles
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

  const numTiles = tileWidth * tileHeight;
  const numBins = 256 * tileWidth * tileHeight;

  const initialRenderableFaces: TwoPassInitialRenderableFace[] = [];
  const initialEdges: LinearEdge[] = [];
  const instructionsEncoder = new ByteEncoder();

  for ( const renderableFace of renderableFaces ) {

    // TODO: remove debugging note
    // if ( renderableFaces.indexOf( renderableFace ) !== 2 ) {
    //   continue;
    // }

    const face = renderableFace.face;
    const edgedFace = face.toEdgedFace();

    // TODO: could CULL out faces that aren't needed (don't we already do this effectively?)

    const renderProgramIndex = instructionsEncoder.byteLength / 4;

    const instructions: RenderInstruction[] = [];
    renderableFace.renderProgram.writeInstructions( instructions );
    RenderInstruction.instructionsToBinary( instructionsEncoder, instructions );

    const needsCentroid = renderableFace.renderProgram.needsCentroid;
    const needsFace = renderableFace.renderProgram.needsFace;
    const isConstant = renderableFace.renderProgram instanceof RenderColor;

    const edgesIndex = initialEdges.length;
    const numEdges = edgedFace.edges.length;
    initialEdges.push( ...edgedFace.edges );

    initialRenderableFaces.push( {
      renderProgramIndex: renderProgramIndex,
      needsCentroid: needsCentroid,
      needsFace: needsFace,
      isConstant: isConstant,
      isFullArea: false,
      edgesIndex: edgesIndex,
      numEdges: numEdges
    } );
  }

  // TODO: get the typing so we don't need to do this
  const renderProgramInstructions = [ ...instructionsEncoder.u32Array ];

  const configSlot = new BufferSlot( TwoPassConfigType );
  const initialRenderableFacesSlot = new BufferArraySlot( getArrayType( TwoPassInitialRenderableFaceType, initialRenderableFaces.length ) ); // TODO: variable size
  const initialEdgesSlot = new BufferArraySlot( getArrayType( LinearEdgeType, initialEdges.length ) ); // TODO: variable size
  const renderProgramInstructionsSlot = new BufferArraySlot( getArrayType( U32Type, renderProgramInstructions.length ) ); // TODO: variable size
  const outputSlot = new TextureViewSlot();

  const mainModule = new TiledTwoPassModule( {
    name: `module_${name}`,
    // log: true,
    config: configSlot,
    initialRenderableFaces: initialRenderableFacesSlot,
    initialEdges: initialEdgesSlot,
    renderProgramInstructions: renderProgramInstructionsSlot,
    output: outputSlot,
    storageFormat: deviceContext.preferredStorageFormat, // e.g. deviceContext.preferredStorageFormat
    twoPassModuleOptions: {
      mainTwoPassFineModuleOptions: {
        supportsGridFiltering: supportsGridFiltering,
        supportsBilinear: supportsBilinear,
        supportsMitchellNetravali: supportsMitchellNetravali
      }
    },
    numInitialRenderableFaces: u32S( initialRenderableFaces.length )
  } );

  // Pick the opposite of the storage format, in case we can't write to it directly, and need to blit it over
  const potentialBlitFormat = deviceContext.preferredStorageFormat === 'bgra8unorm' ? 'rgba8unorm' : 'bgra8unorm';
  const blitShader = new BlitShader( deviceContext.device, potentialBlitFormat );
  const wrapBlitModule = new CompositeModule( [ mainModule ], ( context, data: { numTiles: number; numBins: number; numInitialRenderableFaces: number; textureBlit: [ GPUTextureView, GPUTextureView ] | null } ) => {
    mainModule.execute( context, {
      numTiles: data.numTiles,
      numBins: data.numBins,
      numInitialRenderableFaces: data.numInitialRenderableFaces
    } );

    if ( data.textureBlit ) {
      const encoder = context.getEncoderForCustomRender();
      blitShader.dispatch( encoder, data.textureBlit[ 1 ], data.textureBlit[ 0 ] );
    }
  } );

  const routine = await Routine.create(
    deviceContext,
    wrapBlitModule,
    [ configSlot, initialRenderableFacesSlot, initialEdgesSlot, renderProgramInstructionsSlot ],
    Routine.INDIVIDUAL_LAYOUT_STRATEGY,
    async ( context, execute, input: {
      config: TwoPassConfig;
      initialRenderableFaces: TwoPassInitialRenderableFace[];
      initialEdges: LinearEdge[];
      renderProgramInstructions: number[];
      textureBlit: [ GPUTextureView, GPUTextureView ] | null;
    } ) => {
      // console.log( 'coarse faces', input.coarseRenderableFaces );
      // console.log( 'coarse edges', input.coarseEdges );

      context.setTypedBufferValue( configSlot, input.config );
      context.setTypedBufferValue( initialRenderableFacesSlot, input.initialRenderableFaces );
      context.setTypedBufferValue( initialEdgesSlot, input.initialEdges );
      context.setTypedBufferValue( renderProgramInstructionsSlot, input.renderProgramInstructions );

      execute( context, {
        numTiles: numTiles,
        numBins: numBins,
        numInitialRenderableFaces: input.initialRenderableFaces.length,
        textureBlit: input.textureBlit
      } );

      // const addressesPromise = context.u32Numbers( mainModule.coarseModule.addresses );
      // const fineFacesPromise = context.arrayBuffer( mainModule.coarseModule.fineRenderableFaces );
      // const fineEdgesPromise = context.arrayBuffer( mainModule.coarseModule.fineEdges );
      //
      // const addresses = await addressesPromise;
      // console.log( 'addresses', addresses.slice( 0, numBins + 2 ) );
      //
      // const numFineFaces = addresses[ 0 ];
      // const numFineEdges = addresses[ 1 ];
      //
      // // console.log( await context.u32Numbers( mainModule.coarseModule.fineRenderableFaces ) );
      // const faceEncoder = new ByteEncoder( await fineFacesPromise );
      // console.log( 'fine faces', getArrayType( TwoPassFineRenderableFaceType, numFineFaces ).decode( faceEncoder, 0 ) );
      //
      // const edgesEncoder = new ByteEncoder( await fineEdgesPromise );
      // console.log( 'fine edges', getArrayType( LinearEdgeType, numFineEdges ).decode( edgesEncoder, 0 ) );


      // console.log( await context.arrayBuffer( mainModule.coarseModule.fineRenderableFaces ) );

      // TODO: do we need to wait for anything here?
      return Promise.resolve( null );
    }
  );

  const canvas = document.createElement( 'canvas' );
  canvas.width = rasterWidth;
  canvas.height = rasterHeight;
  canvas.style.width = `${rasterWidth / window.devicePixelRatio}px`; // TODO: hopefully integral for tests
  canvas.style.height = `${rasterHeight / window.devicePixelRatio}px`;
  // canvas.style.width = `${256 * 4}px`; // TODO: hopefully integral for tests
  // canvas.style.height = `${256 * 4}px`;
  // canvas.style.imageRendering = 'pixelated';

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
    initialRenderableFaces: initialRenderableFaces,
    initialEdges: initialEdges,
    renderProgramInstructions: renderProgramInstructions,
    textureBlit: canOutputToCanvas ? null : [ fineOutputTextureView, canvasTextureView ]
  } );

  procedure.dispose();

  return canvas;
};

alpenglow.register( 'evaluateTwoPassTiled', evaluateTwoPassTiled );