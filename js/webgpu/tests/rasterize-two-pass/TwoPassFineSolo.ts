// Copyright 2024, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BufferArraySlot, BufferSlot, ByteEncoder, DeviceContext, DirectModule, getArrayType, LinearEdge, LinearEdgeType, mainTwoPassFineWGSL, PolygonFilterType, Procedure, Rasterize, RenderColor, RenderColorSpace, RenderInstruction, RenderLinearBlend, RenderLinearBlendAccuracy, RenderPath, RenderPathBoolean, RenderStack, Routine, TextureViewResource, TextureViewSlot, TwoPassConfig, TwoPassConfigType, TwoPassFineRenderableFace, TwoPassFineRenderableFaceType, U32Type } from '../../../imports.js';
import Vector3 from '../../../../../dot/js/Vector3.js';
import testPolygonalFace from '../testPolygonalFace.js';
import Bounds2 from '../../../../../dot/js/Bounds2.js';

export const evaluateTwoPassFineSolo = async (
  name: string,
  deviceContext: DeviceContext
): Promise<HTMLCanvasElement> => {

  const filterType = PolygonFilterType.Bilinear;
  const filterScale = 10;

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

  // TODO: grid clip type
  // const binSize = filterScale === 1 ? {
  //   [ PolygonFilterType.Box ]: 16,
  //   [ PolygonFilterType.Bilinear ]: 15,
  //   [ PolygonFilterType.MitchellNetravali ]: 13
  // }[ filterType ] : 16;
  const binSize = 16; // TODO: don't fix at 16 forever for filtering
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
        const minX = binX * 16 - filterExpansion;
        const minY = binY * 16 - filterExpansion;
        const maxX = ( binX + 1 ) * 16 + filterExpansion;
        const maxY = ( binY + 1 ) * 16 + filterExpansion;
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

  const module = new DirectModule<number>( {
    name: `module_${name}`,
    // log: true,
    main: mainTwoPassFineWGSL( {
      config: configSlot,
      addresses: addressesSlot,
      fineRenderableFaces: fineRenderableFacesSlot,
      renderProgramInstructions: renderProgramInstructionsSlot,
      edges: edgesSlot,
      output: outputSlot,
      storageFormat: deviceContext.preferredStorageFormat // e.g. deviceContext.preferredStorageFormat
    } ),
    setDispatchSize: ( dispatchSize: Vector3, size: number ) => {
      dispatchSize.x = size;
    }
  } );

  const routine = await Routine.create(
    deviceContext,
    module,
    [ configSlot, addressesSlot, fineRenderableFacesSlot, edgesSlot ],
    Routine.INDIVIDUAL_LAYOUT_STRATEGY,
    ( context, execute, input: { config: TwoPassConfig; addresses: number[]; fineRenderableFaces: TwoPassFineRenderableFace[]; renderProgramInstructions: number[]; edges: LinearEdge[] } ) => {
      context.setTypedBufferValue( configSlot, input.config );
      context.setTypedBufferValue( addressesSlot, input.addresses );
      context.setTypedBufferValue( fineRenderableFacesSlot, input.fineRenderableFaces );
      context.setTypedBufferValue( renderProgramInstructionsSlot, input.renderProgramInstructions );
      context.setTypedBufferValue( edgesSlot, input.edges );

      execute( context, numBins );

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
    edges: edges
  } );

  procedure.dispose();

  return canvas;
};

alpenglow.register( 'evaluateTwoPassFineSolo', evaluateTwoPassFineSolo );