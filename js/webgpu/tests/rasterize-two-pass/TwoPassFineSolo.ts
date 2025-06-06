// Copyright 2024-2025, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import Bounds2 from '../../../../../dot/js/Bounds2.js';
import Matrix3 from '../../../../../dot/js/Matrix3.js';
import Vector2 from '../../../../../dot/js/Vector2.js';
import Vector4 from '../../../../../dot/js/Vector4.js';
import { DeviceContext } from '../../compute/DeviceContext.js';
import { testPolygonalFace } from '../testPolygonalFace.js';
import { TwoPassFineRenderableFace } from '../../wgsl/rasterize-two-pass/TwoPassFineRenderableFace.js';
import { ByteEncoder } from '../../compute/ByteEncoder.js';
import { LinearEdge } from '../../../cag/LinearEdge.js';
import { RenderInstruction } from '../../../render-program/RenderInstruction.js';
import { BufferSlot } from '../../compute/BufferSlot.js';
import { TwoPassConfigType } from '../../wgsl/rasterize-two-pass/TwoPassConfigType.js';
import { BufferArraySlot } from '../../compute/BufferArraySlot.js';
import { getArrayType, U32Type } from '../../compute/ConcreteType.js';
import { TwoPassFineRenderableFaceType } from '../../wgsl/rasterize-two-pass/TwoPassFineRenderableFaceType.js';
import { LinearEdgeType } from '../../wgsl/cag/LinearEdgeType.js';
import { TextureViewSlot } from '../../compute/TextureViewSlot.js';
import { MainTwoPassFineModule } from '../../modules/rasterize-two-pass/MainTwoPassFineModule.js';
import { BlitShader } from '../../BlitShader.js';
import { CompositeModule } from '../../compute/CompositeModule.js';
import { PolygonFilterType } from '../../../render-program/PolygonFilterType.js';
import { RenderColorSpace } from '../../../render-program/RenderColorSpace.js';
import { RenderStack } from '../../../render-program/RenderStack.js';
import { RenderPathBoolean } from '../../../render-program/RenderPathBoolean.js';
import { RenderPath } from '../../../render-program/RenderPath.js';
import { RenderColor } from '../../../render-program/RenderColor.js';
import { RenderLinearBlend } from '../../../render-program/RenderLinearBlend.js';
import { Rasterize } from '../../../raster/Rasterize.js';
import { Routine } from '../../compute/Routine.js';
import { TwoPassConfig } from '../../wgsl/rasterize-two-pass/TwoPassConfig.js';
import { Procedure } from '../../compute/Procedure.js';
import { TextureViewResource } from '../../compute/TextureViewResource.js';
import { alpenglow } from '../../../alpenglow.js';
import { convertColorSpace } from '../../../render-program/convertColorSace.js';
import { RenderLinearBlendAccuracy } from '../../../render-program/RenderLinearBlendAccuracy.js';

export const evaluateTwoPassFineSolo = async (
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

  const unpaddedAddresses = _.range( 0, numBins ).map( i => 0xffffffff );
  const fineRenderableFaces: TwoPassFineRenderableFace[] = [];
  const instructionsEncoder = new ByteEncoder();

  const edges: LinearEdge[] = [];

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

    for ( let binX = 0; binX < binWidth; binX++ ) {
      for ( let binY = 0; binY < binHeight; binY++ ) {
        const minX = binX * binSize - filterExpansion;
        const minY = binY * binSize - filterExpansion;
        const maxX = ( binX + 1 ) * binSize + filterExpansion;
        const maxY = ( binY + 1 ) * binSize + filterExpansion;
        const maxArea = ( maxX - minX ) * ( maxY - minY );

        // NOTE: Use the below option if needing to remove edge-clipped counts for debugging
        // TODO: can we replace "some" of them but not ALL?
        // const face = edgeClippedFace.getClipped( minX, minY, maxX, maxY ).toEdgedFace().toEdgedClippedFaceWithoutCheck( minX, minY, maxX, maxY );
        const face = edgeClippedFace.getClipped( minX, minY, maxX, maxY );
        if ( face.getArea() > 1e-4 ) {

          const address = fineRenderableFaces.length;

          const tileIndex = Math.floor( binX / 16 ) + Math.floor( binY / 16 ) * tileWidth;

          const relativeBinIndex = ( binX % 16 ) + ( binY % 16 ) * 16;

          const binIndex = relativeBinIndex + ( tileIndex << 8 );

          const nextAddress = unpaddedAddresses[ binIndex ];
          unpaddedAddresses[ binIndex ] = address;

          if ( face.getArea() + 1e-6 >= maxArea ) {
            fineRenderableFaces.push( {
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
              nextAddress: nextAddress
            } );
          }
          else {
            const edgesIndex = edges.length;
            const numEdges = face.edges.length;
            edges.push( ...face.edges );

            fineRenderableFaces.push( {
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
              nextAddress: nextAddress
            } );
          }
        }
      }
    }
  }

  // TODO: get the typing so we don't need to do this
  const renderProgramInstructions = [ ...instructionsEncoder.u32Array ];

  // const edgeClippedFace = testFace.toEdgedClippedFace( 0, 0, 512, 512 );


  const configSlot = new BufferSlot( TwoPassConfigType );
  // const addressesAtomicSlot = new BufferArraySlot( getArrayType( U32AtomicType, numBins + 2 ) ); // TODO: variable size
  const addressesSlot = new BufferArraySlot( getArrayType( U32Type, numBins + 2 ) ); // TODO: variable size
  const fineRenderableFacesSlot = new BufferArraySlot( getArrayType( TwoPassFineRenderableFaceType, fineRenderableFaces.length ) ); // TODO: variable size
  const renderProgramInstructionsSlot = new BufferArraySlot( getArrayType( U32Type, renderProgramInstructions.length ) ); // TODO: variable size
  const edgesSlot = new BufferArraySlot( getArrayType( LinearEdgeType, edges.length ) ); // TODO: variable size
  const outputSlot = new TextureViewSlot();

  const mainModule = new MainTwoPassFineModule( {
    name: `module_${name}`,

    config: configSlot,
    addresses: addressesSlot,
    fineRenderableFaces: fineRenderableFacesSlot,
    renderProgramInstructions: renderProgramInstructionsSlot,
    edges: edgesSlot,
    output: outputSlot,
    storageFormat: deviceContext.preferredStorageFormat, // e.g. deviceContext.preferredStorageFormat
    supportsGridFiltering: supportsGridFiltering,
    supportsBilinear: supportsBilinear,
    supportsMitchellNetravali: supportsMitchellNetravali
  } );

  // Pick the opposite of the storage format, in case we can't write to it directly, and need to blit it over
  const potentialBlitFormat = deviceContext.preferredStorageFormat === 'bgra8unorm' ? 'rgba8unorm' : 'bgra8unorm';
  const blitShader = new BlitShader( deviceContext.device, potentialBlitFormat );
  const wrapBlitModule = new CompositeModule( [ mainModule ], ( context, data: { numBins: number; textureBlit: [ GPUTextureView, GPUTextureView ] | null } ) => {
    mainModule.execute( context, data.numBins );

    if ( data.textureBlit ) {
      const encoder = context.getEncoderForCustomRender();
      blitShader.dispatch( encoder, data.textureBlit[ 1 ], data.textureBlit[ 0 ] );
    }
  } );

  const routine = await Routine.create(
    deviceContext,
    wrapBlitModule,
    [ configSlot, addressesSlot, fineRenderableFacesSlot, edgesSlot ],
    Routine.INDIVIDUAL_LAYOUT_STRATEGY,
    ( context, execute, input: {
      config: TwoPassConfig;
      addresses: number[];
      fineRenderableFaces: TwoPassFineRenderableFace[];
      renderProgramInstructions: number[];
      edges: LinearEdge[];
      textureBlit: [ GPUTextureView, GPUTextureView ] | null;
    } ) => {
      context.setTypedBufferValue( configSlot, input.config );
      context.setTypedBufferValue( addressesSlot, input.addresses );
      context.setTypedBufferValue( fineRenderableFacesSlot, input.fineRenderableFaces );
      context.setTypedBufferValue( renderProgramInstructionsSlot, input.renderProgramInstructions );
      context.setTypedBufferValue( edgesSlot, input.edges );

      execute( context, {
        numBins: numBins,
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
    addresses: [ 0, 0, ...unpaddedAddresses ],
    fineRenderableFaces: fineRenderableFaces,
    renderProgramInstructions: renderProgramInstructions,
    edges: edges,
    textureBlit: canOutputToCanvas ? null : [ fineOutputTextureView, canvasTextureView ]
  } );

  procedure.dispose();

  return canvas;
};

alpenglow.register( 'evaluateTwoPassFineSolo', evaluateTwoPassFineSolo );