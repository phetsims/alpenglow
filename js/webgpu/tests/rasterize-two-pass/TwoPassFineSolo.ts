// Copyright 2024, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BufferArraySlot, BufferSlot, DeviceContext, DirectModule, getArrayType, LinearEdge, LinearEdgeType, mainTwoPassFineWGSL, PolygonalFace, Procedure, Routine, TextureViewResource, TextureViewSlot, TwoPassConfig, TwoPassConfigType, TwoPassFineRenderableFace, TwoPassFineRenderableFaceType, U32Type } from '../../../imports.js';
import Vector3 from '../../../../../dot/js/Vector3.js';
import Vector2 from '../../../../../dot/js/Vector2.js';

export const evaluateTwoPassFineSolo = async (
  name: string,
  deviceContext: DeviceContext
): Promise<HTMLCanvasElement> => {
  const numBins = 256;

  const unpaddedAddresses = _.range( 0, 256 ).map( i => 0xffffffff );
  unpaddedAddresses[ 0 ] = 0;
  unpaddedAddresses[ 1 ] = 4;
  unpaddedAddresses[ 2 ] = 2;
  unpaddedAddresses[ 3 ] = 3;

  const fineRenderableFaces = [
    {
      renderProgramIndex: 0,
      needsCentroid: false,
      needsFace: false,
      isConstant: true,
      isFullArea: false,
      edgesIndex: 0,
      numEdges: 4,
      minXCount: 0,
      minYCount: 0,
      maxXCount: 0,
      maxYCount: 0,
      nextAddress: 0xffffffff
    },
    {
      renderProgramIndex: 0,
      needsCentroid: false,
      needsFace: false,
      isConstant: true,
      isFullArea: false,
      edgesIndex: 4,
      numEdges: 3,
      minXCount: 0,
      minYCount: 0,
      maxXCount: 0,
      maxYCount: 0,
      nextAddress: 0xffffffff
    },
    {
      renderProgramIndex: 0,
      needsCentroid: false,
      needsFace: false,
      isConstant: true,
      isFullArea: true,
      edgesIndex: 0,
      numEdges: 0,
      minXCount: 0,
      minYCount: 0,
      maxXCount: 0,
      maxYCount: 0,
      nextAddress: 0xffffffff
    },
    {
      renderProgramIndex: 0,
      needsCentroid: false,
      needsFace: false,
      isConstant: true,
      isFullArea: false,
      edgesIndex: 0,
      numEdges: 0,
      minXCount: -1,
      minYCount: 1,
      maxXCount: 1,
      maxYCount: -1,
      nextAddress: 0xffffffff
    },
    {
      renderProgramIndex: 0,
      needsCentroid: false,
      needsFace: false,
      isConstant: true,
      isFullArea: false,
      edgesIndex: 7,
      numEdges: 3,
      minXCount: 0,
      minYCount: 0,
      maxXCount: 0,
      maxYCount: 0,
      nextAddress: 1
    }
  ];

  const edges = [
    ...LinearEdge.fromPolygon( [
      new Vector2( 5, 5 ),
      new Vector2( 16, 2 ),
      new Vector2( 16, 14 ),
      new Vector2( 2, 14 )
    ] ),

    ...LinearEdge.fromPolygon( [
      new Vector2( 16, 2 ),
      new Vector2( 20, 10 ),
      new Vector2( 16, 14 )
    ] ),

    ...LinearEdge.fromPolygon( [
      new Vector2( 23, 6 ),
      new Vector2( 32, 0 ),
      new Vector2( 32, 16 )
    ] )
  ];

  const testFace = new PolygonalFace( [
    [
      new Vector2( 30, 30 ),
      new Vector2( 130, 45 ),
      new Vector2( 60, 125 )
    ]
  ] );

  const edgeClippedFace = testFace.toEdgedClippedFace( 0, 0, 256, 256 );

  for ( let binX = 0; binX < 16; binX++ ) {
    for ( let binY = 0; binY < 16; binY++ ) {
      const minX = binX * 16;
      const minY = binY * 16;
      const maxX = minX + 16;
      const maxY = minY + 16;

      const face = edgeClippedFace.getClipped( minX, minY, maxX, maxY );
      if ( face.getArea() > 1e-7 ) {

        const address = fineRenderableFaces.length;
        const binIndex = binY * 16 + binX;

        const nextAddress = unpaddedAddresses[ binIndex ];
        unpaddedAddresses[ binIndex ] = address;

        if ( face.getArea() + 1e-6 >= 256 ) {
          fineRenderableFaces.push( {
            renderProgramIndex: 0,
            needsCentroid: false,
            needsFace: false,
            isConstant: false,
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
            renderProgramIndex: 0,
            needsCentroid: false,
            needsFace: false,
            isConstant: false,
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

  const configSlot = new BufferSlot( TwoPassConfigType );
  // const addressesAtomicSlot = new BufferArraySlot( getArrayType( U32AtomicType, numBins + 2 ) ); // TODO: variable size
  const addressesSlot = new BufferArraySlot( getArrayType( U32Type, numBins + 2 ) ); // TODO: variable size
  const fineRenderableFacesSlot = new BufferArraySlot( getArrayType( TwoPassFineRenderableFaceType, fineRenderableFaces.length ) ); // TODO: variable size
  const edgesSlot = new BufferArraySlot( getArrayType( LinearEdgeType, edges.length ) ); // TODO: variable size
  const outputSlot = new TextureViewSlot();

  const module = new DirectModule<number>( {
    name: `module_${name}`,
    main: mainTwoPassFineWGSL( {
      config: configSlot,
      addresses: addressesSlot,
      fineRenderableFaces: fineRenderableFacesSlot,
      edges: edgesSlot,
      output: outputSlot,
      storageFormat: deviceContext.preferredStorageFormat, // e.g. deviceContext.preferredStorageFormat
      integerScale: 1
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
    ( context, execute, input: { config: TwoPassConfig; addresses: number[]; fineRenderableFaces: TwoPassFineRenderableFace[]; edges: LinearEdge[] } ) => {
      context.setTypedBufferValue( configSlot, input.config );
      context.setTypedBufferValue( addressesSlot, input.addresses );
      context.setTypedBufferValue( fineRenderableFacesSlot, input.fineRenderableFaces );
      context.setTypedBufferValue( edgesSlot, input.edges );

      execute( context, numBins );

      // TODO: do we need to wait for anything here?
      return Promise.resolve( null );
    }
  );

  const canvas = document.createElement( 'canvas' );
  canvas.width = 256;
  canvas.height = 256;
  // canvas.style.width = `${256 / window.devicePixelRatio}px`; // TODO: hopefully integral for tests
  // canvas.style.height = `${256 / window.devicePixelRatio}px`;
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

  const procedure = new Procedure( routine ).bindRemainingBuffers();
  procedure.bind( outputSlot, new TextureViewResource( fineOutputTextureView ) );

  await procedure.standaloneExecute( deviceContext, {
    config: {
      rasterWidth: 256,
      rasterHeight: 256,
      tileWidth: 1,
      tileHeight: 1,
      binWidth: 16,
      binHeight: 16,
      tileSize: 256,
      binSize: 16,
      filter: 0,
      filterScale: 1,
      rasterColorSpace: 0
    },
    addresses: [ 0, 0, ...unpaddedAddresses ],
    fineRenderableFaces: fineRenderableFaces,
    edges: edges
  } );

  procedure.dispose();

  return canvas;
};

alpenglow.register( 'evaluateTwoPassFineSolo', evaluateTwoPassFineSolo );