// Copyright 2023, University of Colorado Boulder

/**
 * Rasterization prototype for WebGPU, but using the parallel (debuggable) API.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, Binding, BufferLogger, ByteEncoder, CombinedRaster, ComputeShader, DeviceContext, ParallelRasterChunkIndexPatch, ParallelRasterChunkReduce, ParallelRasterEdgeIndexPatch, ParallelRasterEdgeScan, ParallelRasterInitialChunk, ParallelRasterInitialClip, ParallelRasterInitialEdgeReduce, ParallelRasterInitialSplitReduce, ParallelRasterSplitReduce, ParallelRasterSplitScan, ParallelStorageArray, RasterChunk, RasterChunkReducePair, RasterChunkReduceQuad, RasterClippedChunk, RasterCompleteChunk, RasterCompleteEdge, RasterEdge, RasterEdgeClip, RasterSplitReduceData, TestToCanvas, wgsl_raster_chunk_index_patch, wgsl_raster_chunk_reduce, wgsl_raster_edge_index_patch, wgsl_raster_edge_scan, wgsl_raster_initial_chunk, wgsl_raster_initial_clip, wgsl_raster_initial_edge_reduce, wgsl_raster_initial_split_reduce, wgsl_raster_split_reduce, wgsl_raster_split_scan, wgsl_raster_uniform_update } from '../../imports.js';
import Vector4 from '../../../../dot/js/Vector4.js';
import Vector2 from '../../../../dot/js/Vector2.js';

// TODO: move to 256 after testing (64 helps us test more cases here)
// const WORKGROUP_SIZE = 64;
// const LOG = false;
// const USE_DEMO = true;
// const ONLY_FIRST_ITERATION = false;

const WORKGROUP_SIZE = 4;
const LOG = true;
const USE_DEMO = false;
const ONLY_FIRST_ITERATION = true;

export default class ParallelRaster {

  public static getTestRawInputChunks(): RasterChunk[] {
    return [
      new RasterChunk(
        0,
        false,
        true,
        0,
        5,
        0, 0, 10, 10,
        -1, 1, 0, 0
      ),
      new RasterChunk(
        1,
        false,
        false,
        5,
        3,
        10, 0, 20, 10,
        0, 1, 0, 0
      ),
      new RasterChunk(
        2,
        true,
        false,
        8,
        1,
        9, 8, 10, 10,
        -1, 1, 0, 0
      ),
      new RasterChunk(
        3,
        true,
        false,
        9,
        4,
        7, 9, 9, 10,
        0, 0, 0, 0
      ),
      new RasterChunk(
        4,
        true,
        false,
        13,
        6,
        10, 5, 20, 10,
        0, 0, 0, 0
      ),
      new RasterChunk(
        5,
        true,
        false,
        19,
        1,
        19, 3, 20, 4,
        -1, 1, 0, 0
      ),
      new RasterChunk(
        6,
        false,
        false,
        20,
        0,
        11, 8, 12, 9,
        -1, 1, 1, -1
      ),
      new RasterChunk(
        7,
        false,
        false,
        20,
        0,
        12, 6, 18, 10,
        -1, 1, 1, -1
      ),
      new RasterChunk(
        8,
        false,
        false,
        20,
        0,
        0, 0, 10, 10,
        0, 0, 0, 0
      )
    ];
  }

  public static getTestRawInputEdges(): RasterEdge[] {
    return [
      new RasterEdge(
        0,
        true,
        false,
        new Vector2( 10, 0 ),
        new Vector2( 10, 6 )
      ),
      new RasterEdge(
        0,
        false,
        false,
        new Vector2( 10, 6 ),
        new Vector2( 0, 10 )
      ),
      new RasterEdge(
        0,
        false,
        false,
        new Vector2( 1, 1 ),
        new Vector2( 3, 6 )
      ),
      new RasterEdge(
        0,
        false,
        false,
        new Vector2( 3, 6 ),
        new Vector2( 4, 2 )
      ),
      new RasterEdge(
        0,
        false,
        true,
        new Vector2( 4, 2 ),
        new Vector2( 1, 1 )
      ),
      new RasterEdge(
        1,
        true,
        false,
        new Vector2( 20, 0 ),
        new Vector2( 20, 2 )
      ),
      new RasterEdge(
        1,
        false,
        false,
        new Vector2( 20, 2 ),
        new Vector2( 10, 6 )
      ),
      new RasterEdge(
        1,
        false,
        true,
        new Vector2( 10, 6 ),
        new Vector2( 10, 0 )
      ),
      new RasterEdge(
        2,
        true,
        true,
        new Vector2( 10, 8 ),
        new Vector2( 9, 10 )
      ),
      new RasterEdge(
        3,
        true,
        false,
        new Vector2( 7.5, 9 ),
        new Vector2( 9, 9 )
      ),
      new RasterEdge(
        3,
        false,
        false,
        new Vector2( 9, 9 ),
        new Vector2( 9, 10 )
      ),
      new RasterEdge(
        3,
        false,
        false,
        new Vector2( 9, 10 ),
        new Vector2( 7.5, 10 )
      ),
      new RasterEdge(
        3,
        false,
        true,
        new Vector2( 7.5, 10 ),
        new Vector2( 7.5, 9 )
      ),
      new RasterEdge(
        4,
        true,
        false,
        new Vector2( 10, 9 ),
        new Vector2( 11, 9 )
      ),
      new RasterEdge(
        4,
        false,
        false,
        new Vector2( 11, 9 ),
        new Vector2( 10, 10 )
      ),
      new RasterEdge(
        4,
        false,
        false,
        new Vector2( 10, 10 ),
        new Vector2( 10, 9 )
      ),
      new RasterEdge(
        4,
        false,
        false,
        new Vector2( 19, 9 ),
        new Vector2( 20, 9 )
      ),
      new RasterEdge(
        4,
        false,
        false,
        new Vector2( 20, 9 ),
        new Vector2( 19, 10 )
      ),
      new RasterEdge(
        4,
        false,
        true,
        new Vector2( 19, 10 ),
        new Vector2( 19, 9 )
      ),
      new RasterEdge(
        5,
        true,
        true,
        new Vector2( 20, 4 ),
        new Vector2( 19, 5 )
      )
    ];
  }

  public static async test(): Promise<void> {

    let rawInputChunks = ParallelRaster.getTestRawInputChunks();
    let rawInputEdges = ParallelRaster.getTestRawInputEdges();

    if ( USE_DEMO ) {
      rawInputEdges = [];
      const unprocessedEdges = TestToCanvas.getTestPath().toEdgedFace().edges;
      unprocessedEdges.forEach( ( edge, i ) => {
        rawInputEdges.push( new RasterEdge(
          0,
          i === 0,
          i === unprocessedEdges.length - 1,
          // NOTE: reversed here, due to our test path!!!
          edge.endPoint.timesScalar( 0.35 ),
          edge.startPoint.timesScalar( 0.35 )
        ) );
      } );
      rawInputChunks = [ new RasterChunk(
        0,
        false,
        true,
        0,
        rawInputEdges.length,
        0, 0, 256, 256,
        0, 0, 0, 0
      ) ];
    }

    const numInputChunks = rawInputChunks.length;
    const numInputEdges = rawInputEdges.length;

    const inputChunks = new ParallelStorageArray( rawInputChunks, RasterChunk.INDETERMINATE );
    const inputEdges = new ParallelStorageArray( rawInputEdges, RasterEdge.INDETERMINATE );

    assert && RasterChunk.validate( inputChunks, inputEdges, numInputChunks, numInputEdges );

    let numChunks = numInputChunks;
    let numEdges = numInputEdges;
    let chunks = inputChunks;
    let edges = inputEdges;

    const finishedChunks = [];

    let stageCount = 1;
    while ( numChunks > 0 ) {
      console.log( `Stage ${stageCount++}` );
      LOG && console.log( '**********' );
      LOG && console.log( '**********' );
      LOG && console.log( '**********' );
      LOG && console.log( '**********' );
      LOG && console.log( '**********' );

      const result = await ParallelRaster.process( WORKGROUP_SIZE, numChunks, numEdges, chunks, edges );

      finishedChunks.push( ...result.completeChunks.data.slice( 0, result.numCompleteChunks ) );

      numChunks = result.numReducibleChunks;
      numEdges = result.numReducibleEdges;
      chunks = result.reducibleChunks;
      edges = result.reducibleEdges;

      if ( ONLY_FIRST_ITERATION ) {
        break;
      }
    }

    const raster = new CombinedRaster( 256, 256, {
      colorSpace: 'display-p3'
    } );

    const color = new Vector4( 1, 0, 0, 1 );
    LOG && console.log( `finishedChunks: ${finishedChunks.length}` );
    finishedChunks.forEach( chunk => {
      if ( chunk.isFullArea ) {
        raster.addClientFullRegion( color, chunk.minX, chunk.minY, chunk.maxX - chunk.minX, chunk.maxY - chunk.minY );
      }
      else {
        raster.addClientPartialPixel( color.timesScalar( chunk.area ), chunk.minX, chunk.minY );
      }
    } );

    const canvas = raster.toCanvas();
    canvas.style.width = '512px';
    canvas.style.height = '512px';
    canvas.style.imageRendering = 'pixelated';
    canvas.style.position = 'absolute';
    document.body.appendChild( canvas );
  }

  public static async webgpuTest(): Promise<void> {
    const device = ( await DeviceContext.getDevice() )!;
    assert && assert( device );

    const deviceContext = new DeviceContext( device );

    const logger = new BufferLogger( deviceContext );

    // const displaySize = 512;

    const rawInputChunks = ParallelRaster.getTestRawInputChunks();
    const rawInputEdges = ParallelRaster.getTestRawInputEdges();

    const numInputChunks = rawInputChunks.length;
    const numInputEdges = rawInputEdges.length;
    const numClippedChunks = 2 * numInputChunks;
    const numEdgeClips = 2 * numInputEdges;

    const workgroupSize = WORKGROUP_SIZE;
    const RASTER_CLIPPED_CHUNK_BYTES = 4 * 10;

    // TODO: figure out better output buffer size, since it's hard to bound
    const MAX_COMPLETE_CHUNKS = 100000;

    // TODO: figure out better output buffer size, since it's hard to bound
    const MAX_COMPLETE_EDGES = 100000;

    const configData = [

      // initial_chunk workgroup
      Math.ceil( numInputChunks / workgroupSize ), 1, 1,

      // initial_clip workgroup
      Math.ceil( numInputEdges / workgroupSize ), 1, 1,

      // chunk_reduce0 workgroup
      Math.ceil( numInputEdges / ( workgroupSize * workgroupSize ) ), 1, 1,

      // chunk_reduce1 workgroup
      Math.ceil( numInputEdges / ( workgroupSize * workgroupSize * workgroupSize ) ), 1, 1,

      // split_reduce_scan workgroup
      Math.ceil( numClippedChunks / workgroupSize ), 1, 1,

      // edge_reduce_scan workgroup
      Math.ceil( numEdgeClips / workgroupSize ), 1, 1,

      // split_reduce0 workgroup
      Math.ceil( numClippedChunks / ( workgroupSize * workgroupSize ) ), 1, 1,

      // split_reduce1 workgroup
      Math.ceil( numClippedChunks / ( workgroupSize * workgroupSize * workgroupSize ) ), 1, 1,

      // edge_reduce0 workgroup
      Math.ceil( numEdgeClips / ( workgroupSize * workgroupSize ) ), 1, 1,

      // edge_reduce1 workgroup
      Math.ceil( numEdgeClips / ( workgroupSize * workgroupSize * workgroupSize ) ), 1, 1,

      numInputChunks,
      numInputEdges,

      numClippedChunks,
      numEdgeClips,

      0, 0, 0, 0
    ];

    // const canvas = document.createElement( 'canvas' );
    // canvas.width = displaySize * window.devicePixelRatio;
    // canvas.height = displaySize * window.devicePixelRatio;
    // canvas.style.width = `${displaySize}px`;
    // canvas.style.height = `${displaySize}px`;

    // const context = deviceContext.getCanvasContext( canvas );
    //
    // const outTexture = context.getCurrentTexture();

    const configBuffer = device.createBuffer( {
      label: 'config buffer',
      size: 4 * configData.length,
      // NOTE: COPY_SRC here for debugging
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE | GPUBufferUsage.INDIRECT | GPUBufferUsage.COPY_SRC
    } );
    device.queue.writeBuffer( configBuffer, 0, new Uint32Array( configData ).buffer );

    const inputChunksBuffer = deviceContext.createBuffer( RasterChunk.ENCODING_BYTE_LENGTH * numInputChunks );
    const inputChunksEncoder = new ByteEncoder( RasterChunk.ENCODING_BYTE_LENGTH * numInputChunks );
    rawInputChunks.forEach( chunk => chunk.writeEncoding( inputChunksEncoder ) );
    assert && assert( inputChunksEncoder.byteLength === RasterChunk.ENCODING_BYTE_LENGTH * numInputChunks );
    device.queue.writeBuffer( inputChunksBuffer, 0, inputChunksEncoder.fullArrayBuffer );

    const inputEdgesBuffer = deviceContext.createBuffer( RasterEdge.ENCODING_BYTE_LENGTH * numInputEdges );
    const inputEdgesEncoder = new ByteEncoder( RasterEdge.ENCODING_BYTE_LENGTH * numInputEdges );
    rawInputEdges.forEach( chunk => chunk.writeEncoding( inputEdgesEncoder ) );
    assert && assert( inputEdgesEncoder.byteLength === RasterEdge.ENCODING_BYTE_LENGTH * numInputEdges );
    device.queue.writeBuffer( inputEdgesBuffer, 0, inputEdgesEncoder.fullArrayBuffer );

    const zeroBuffer = device.createBuffer( { size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST } );
    device.queue.writeBuffer( zeroBuffer, 0, new Uint32Array( [ 0, 0, 0, 0 ] ).buffer );

    const oneBuffer = device.createBuffer( { size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST } );
    device.queue.writeBuffer( oneBuffer, 0, new Uint32Array( [ 1, 1, 1, 1 ] ).buffer );

    const twoBuffer = device.createBuffer( { size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST } );
    device.queue.writeBuffer( twoBuffer, 0, new Uint32Array( [ 2, 2, 2, 2 ] ).buffer );

    const threeBuffer = device.createBuffer( { size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST } );
    device.queue.writeBuffer( threeBuffer, 0, new Uint32Array( [ 3, 3, 3, 3 ] ).buffer );

    const DEBUG_REDUCE_BUFFERS = false;

    const shaderOptions = {
      workgroupSize: workgroupSize,
      debugReduceBuffers: DEBUG_REDUCE_BUFFERS
    } as const;

    const initialChunksShader = ComputeShader.fromSource( device, 'initial_chunks', wgsl_raster_initial_chunk, [
      Binding.UNIFORM_BUFFER,
      Binding.READ_ONLY_STORAGE_BUFFER,
      Binding.STORAGE_BUFFER
    ], shaderOptions );

    const initialClipShader = ComputeShader.fromSource( device, 'initial_clip', wgsl_raster_initial_clip, [
      Binding.UNIFORM_BUFFER,
      Binding.READ_ONLY_STORAGE_BUFFER,
      Binding.READ_ONLY_STORAGE_BUFFER,
      Binding.STORAGE_BUFFER,
      Binding.STORAGE_BUFFER,
      Binding.STORAGE_BUFFER,
      ...( DEBUG_REDUCE_BUFFERS ? [ Binding.STORAGE_BUFFER ] : [] )
    ], shaderOptions );

    const chunkReduceShader = ComputeShader.fromSource( device, 'chunk_reduce', wgsl_raster_chunk_reduce, [
      Binding.UNIFORM_BUFFER,
      Binding.UNIFORM_BUFFER,
      Binding.READ_ONLY_STORAGE_BUFFER,
      Binding.STORAGE_BUFFER,
      Binding.STORAGE_BUFFER
    ], shaderOptions );

    const initialSplitReduceShader = ComputeShader.fromSource( device, 'initial_split_reduce', wgsl_raster_initial_split_reduce, [
      Binding.UNIFORM_BUFFER,
      Binding.READ_ONLY_STORAGE_BUFFER,
      Binding.STORAGE_BUFFER,
      ...( DEBUG_REDUCE_BUFFERS ? [ Binding.STORAGE_BUFFER ] : [] )
    ], shaderOptions );

    const initialEdgeReduceShader = ComputeShader.fromSource( device, 'initial_edge_reduce', wgsl_raster_initial_edge_reduce, [
      Binding.UNIFORM_BUFFER,
      Binding.READ_ONLY_STORAGE_BUFFER,
      Binding.READ_ONLY_STORAGE_BUFFER,
      Binding.STORAGE_BUFFER,
      ...( DEBUG_REDUCE_BUFFERS ? [ Binding.STORAGE_BUFFER ] : [] )
    ], shaderOptions );

    const splitReduceShader = ComputeShader.fromSource( device, 'split_reduce', wgsl_raster_split_reduce, [
      Binding.UNIFORM_BUFFER,
      Binding.UNIFORM_BUFFER,
      Binding.STORAGE_BUFFER,
      Binding.STORAGE_BUFFER
    ], shaderOptions );

    const splitScanShader = ComputeShader.fromSource( device, 'split_scan', wgsl_raster_split_scan, [
      Binding.UNIFORM_BUFFER,
      Binding.READ_ONLY_STORAGE_BUFFER,
      Binding.READ_ONLY_STORAGE_BUFFER,
      Binding.READ_ONLY_STORAGE_BUFFER,
      Binding.READ_ONLY_STORAGE_BUFFER,
      Binding.STORAGE_BUFFER,
      Binding.STORAGE_BUFFER,
      Binding.STORAGE_BUFFER,
      ...( DEBUG_REDUCE_BUFFERS ? [ Binding.STORAGE_BUFFER ] : [] )
    ], shaderOptions );

    const edgeScanShader = ComputeShader.fromSource( device, 'edge_scan', wgsl_raster_edge_scan, [
      Binding.UNIFORM_BUFFER,
      Binding.READ_ONLY_STORAGE_BUFFER,
      Binding.READ_ONLY_STORAGE_BUFFER,
      Binding.READ_ONLY_STORAGE_BUFFER,
      Binding.READ_ONLY_STORAGE_BUFFER,
      Binding.READ_ONLY_STORAGE_BUFFER,
      Binding.STORAGE_BUFFER,
      Binding.STORAGE_BUFFER,
      Binding.STORAGE_BUFFER
    ], shaderOptions );

    const chunkIndexPatchShader = ComputeShader.fromSource( device, 'chunk_index_patch', wgsl_raster_chunk_index_patch, [
      Binding.UNIFORM_BUFFER,
      Binding.READ_ONLY_STORAGE_BUFFER,
      Binding.READ_ONLY_STORAGE_BUFFER,
      Binding.READ_ONLY_STORAGE_BUFFER,
      Binding.STORAGE_BUFFER,
      Binding.STORAGE_BUFFER
    ], shaderOptions );

    const uniformUpdateShader = ComputeShader.fromSource( device, 'uniform_update', wgsl_raster_uniform_update, [
      Binding.READ_ONLY_STORAGE_BUFFER,
      Binding.READ_ONLY_STORAGE_BUFFER,
      Binding.STORAGE_BUFFER
    ], shaderOptions );

    const edgeIndexPatchShader = ComputeShader.fromSource( device, 'edge_index_patch', wgsl_raster_edge_index_patch, [
      Binding.UNIFORM_BUFFER,
      Binding.READ_ONLY_STORAGE_BUFFER,
      Binding.READ_ONLY_STORAGE_BUFFER,
      Binding.STORAGE_BUFFER
    ], shaderOptions );

    const encoder = device.createCommandEncoder( {
      label: 'the encoder'
    } );

    LOG && logger.logIndexedImmediate( inputChunksEncoder.fullArrayBuffer, 'inputChunks', RasterChunk );
    LOG && logger.logIndexedImmediate( inputEdgesEncoder.fullArrayBuffer, 'inputEdges', RasterEdge );

    const clippedChunksBuffer = deviceContext.createBuffer( RASTER_CLIPPED_CHUNK_BYTES * numClippedChunks );

    initialChunksShader.dispatchIndirect( encoder, [
      configBuffer,
      inputChunksBuffer,
      clippedChunksBuffer
    ], configBuffer, 0 );

    LOG && logger.logIndexed( encoder, clippedChunksBuffer, 'clippedChunks (initial)', RasterClippedChunk );

    const edgeClipsBuffer = deviceContext.createBuffer( RasterEdgeClip.ENCODING_BYTE_LENGTH * numEdgeClips );
    const chunkReduces0Buffer = deviceContext.createBuffer( RasterChunkReduceQuad.ENCODING_BYTE_LENGTH * Math.ceil( numInputEdges / workgroupSize ) );
    const debugChunkReduces0Buffer = deviceContext.createBuffer( RasterChunkReducePair.ENCODING_BYTE_LENGTH * numInputEdges );

    initialClipShader.dispatchIndirect( encoder, [
      configBuffer,
      inputChunksBuffer,
      inputEdgesBuffer,
      clippedChunksBuffer,
      edgeClipsBuffer,
      chunkReduces0Buffer,
      ...( DEBUG_REDUCE_BUFFERS ? [ debugChunkReduces0Buffer ] : [] )
    ], configBuffer, 12 );

    LOG && logger.logIndexed( encoder, edgeClipsBuffer, 'edgeClips', RasterEdgeClip );
    LOG && logger.logIndexedMultiline( encoder, chunkReduces0Buffer, 'chunkReduces0', RasterChunkReduceQuad );
    if ( DEBUG_REDUCE_BUFFERS ) {
      LOG && logger.logIndexedMultiline( encoder, debugChunkReduces0Buffer, 'debugFullChunkReduces', RasterChunkReducePair );
    }

    const chunkReduces1Buffer = deviceContext.createBuffer( RasterChunkReduceQuad.ENCODING_BYTE_LENGTH * Math.ceil( numInputEdges / ( workgroupSize * workgroupSize ) ) );

    chunkReduceShader.dispatchIndirect( encoder, [
      configBuffer,
      zeroBuffer, // signify our "first" chunkReduce
      chunkReduces0Buffer,
      clippedChunksBuffer,
      chunkReduces1Buffer
    ], configBuffer, 24 );

    LOG && logger.logIndexedMultiline( encoder, chunkReduces1Buffer, 'chunkReduces1', RasterChunkReduceQuad );

    // TODO: don't even have these buffers! We probably need a second shader for that, no?
    const chunkReduces2Buffer = deviceContext.createBuffer( RasterChunkReduceQuad.ENCODING_BYTE_LENGTH * Math.ceil( numInputEdges / ( workgroupSize * workgroupSize * workgroupSize ) ) );

    chunkReduceShader.dispatchIndirect( encoder, [
      configBuffer,
      oneBuffer, // signify our "second" chunkReduce
      chunkReduces1Buffer,
      clippedChunksBuffer,
      chunkReduces2Buffer
    ], configBuffer, 36 );

    LOG && logger.logIndexedMultiline( encoder, chunkReduces2Buffer, 'chunkReduces2', RasterChunkReduceQuad );
    LOG && logger.logIndexed( encoder, clippedChunksBuffer, 'clippedChunks (reduced)', RasterClippedChunk );

    const splitReduces0Buffer = deviceContext.createBuffer( RasterSplitReduceData.ENCODING_BYTE_LENGTH * Math.ceil( numClippedChunks / workgroupSize ) );
    const debugInitialSplitReduceBuffer = deviceContext.createBuffer( RasterSplitReduceData.ENCODING_BYTE_LENGTH * numClippedChunks );

    initialSplitReduceShader.dispatchIndirect( encoder, [
      configBuffer,
      clippedChunksBuffer,
      splitReduces0Buffer,
      ...( DEBUG_REDUCE_BUFFERS ? [ debugInitialSplitReduceBuffer ] : [] )
    ], configBuffer, 48 );

    const edgeReduces0Buffer = deviceContext.createBuffer( RasterSplitReduceData.ENCODING_BYTE_LENGTH * Math.ceil( numEdgeClips / workgroupSize ) );
    const debugInitialEdgeReduceBuffer = deviceContext.createBuffer( RasterSplitReduceData.ENCODING_BYTE_LENGTH * numEdgeClips );

    initialEdgeReduceShader.dispatchIndirect( encoder, [
      configBuffer,
      clippedChunksBuffer,
      edgeClipsBuffer,
      edgeReduces0Buffer,
      ...( DEBUG_REDUCE_BUFFERS ? [ debugInitialEdgeReduceBuffer ] : [] )
    ], configBuffer, 60 );

    const splitReduces1Buffer = deviceContext.createBuffer( RasterSplitReduceData.ENCODING_BYTE_LENGTH * Math.ceil( numClippedChunks / ( workgroupSize * workgroupSize ) ) );

    if ( DEBUG_REDUCE_BUFFERS ) {
      LOG && logger.logIndexed( encoder, debugInitialSplitReduceBuffer, 'debugInitialSplitReduce', RasterSplitReduceData );
    }
    LOG && logger.logIndexed( encoder, splitReduces0Buffer, 'splitReduces0', RasterSplitReduceData );

    splitReduceShader.dispatchIndirect( encoder, [
      configBuffer,
      zeroBuffer, // signify our split0 splitReduce
      splitReduces0Buffer,
      splitReduces1Buffer
    ], configBuffer, 72 );

    LOG && logger.logIndexed( encoder, splitReduces0Buffer, 'splitReduces0 (scanned)', RasterSplitReduceData );
    LOG && logger.logIndexed( encoder, splitReduces1Buffer, 'splitReduces1', RasterSplitReduceData );

    const splitReduces2Buffer = deviceContext.createBuffer( RasterSplitReduceData.ENCODING_BYTE_LENGTH * Math.ceil( numClippedChunks / ( workgroupSize * workgroupSize * workgroupSize ) ) );

    splitReduceShader.dispatchIndirect( encoder, [
      configBuffer,
      oneBuffer, // signify our split1 splitReduce
      splitReduces1Buffer,
      splitReduces2Buffer
    ], configBuffer, 84 );

    LOG && logger.logIndexed( encoder, splitReduces1Buffer, 'splitReduces1 (scanned)', RasterSplitReduceData );
    LOG && logger.logIndexed( encoder, splitReduces2Buffer, 'splitReduces2', RasterSplitReduceData );

    let reducibleChunkCount = -1;
    let completeChunkCount = -1;

    LOG && logger.withBuffer( encoder, splitReduces2Buffer, async arrayBuffer => {
      reducibleChunkCount = new Uint32Array( arrayBuffer )[ 0 ];
      completeChunkCount = new Uint32Array( arrayBuffer )[ 1 ];
    } );

    const edgeReduces1Buffer = deviceContext.createBuffer( RasterSplitReduceData.ENCODING_BYTE_LENGTH * Math.ceil( numEdgeClips / ( workgroupSize * workgroupSize ) ) );

    if ( DEBUG_REDUCE_BUFFERS ) {
      LOG && logger.logIndexed( encoder, debugInitialEdgeReduceBuffer, 'debugInitialEdgeReduce', RasterSplitReduceData );
    }
    LOG && logger.logIndexed( encoder, edgeReduces0Buffer, 'edgeReduces0', RasterSplitReduceData );

    splitReduceShader.dispatchIndirect( encoder, [
      configBuffer,
      twoBuffer, // signify our edge0 splitReduce
      edgeReduces0Buffer,
      edgeReduces1Buffer
    ], configBuffer, 96 );

    LOG && logger.logIndexed( encoder, edgeReduces0Buffer, 'edgeReduces0 (scanned)', RasterSplitReduceData );
    LOG && logger.logIndexed( encoder, edgeReduces1Buffer, 'edgeReduces1', RasterSplitReduceData );

    const edgeReduces2Buffer = deviceContext.createBuffer( RasterSplitReduceData.ENCODING_BYTE_LENGTH * Math.ceil( numEdgeClips / ( workgroupSize * workgroupSize * workgroupSize ) ) );

    splitReduceShader.dispatchIndirect( encoder, [
      configBuffer,
      threeBuffer, // signify our edge1 splitReduce
      edgeReduces1Buffer,
      edgeReduces2Buffer
    ], configBuffer, 108 );

    LOG && logger.logIndexed( encoder, edgeReduces1Buffer, 'edgeReduces1 (scanned)', RasterSplitReduceData );
    LOG && logger.logIndexed( encoder, edgeReduces2Buffer, 'edgeReduces2', RasterSplitReduceData );

    let reducibleEdgeCount = -1;
    let completeEdgeCount = -1;

    LOG && logger.withBuffer( encoder, edgeReduces2Buffer, async arrayBuffer => {
      reducibleEdgeCount = new Uint32Array( arrayBuffer )[ 0 ];
      completeEdgeCount = new Uint32Array( arrayBuffer )[ 1 ];
    } );

    const reducibleChunksBuffer = deviceContext.createBuffer( RasterChunk.ENCODING_BYTE_LENGTH * numClippedChunks );
    const completeChunksBuffer = deviceContext.createBuffer( RasterCompleteChunk.ENCODING_BYTE_LENGTH * MAX_COMPLETE_CHUNKS );
    const chunkIndexMapBuffer = deviceContext.createBuffer( 4 * numClippedChunks );
    const debugSplitScanReducesBuffer = deviceContext.createBuffer( RasterSplitReduceData.ENCODING_BYTE_LENGTH * numClippedChunks );

    splitScanShader.dispatchIndirect( encoder, [
      configBuffer,
      clippedChunksBuffer,
      splitReduces0Buffer,
      splitReduces1Buffer,
      splitReduces2Buffer,
      reducibleChunksBuffer,
      completeChunksBuffer,
      chunkIndexMapBuffer,
      ...( DEBUG_REDUCE_BUFFERS ? [ debugSplitScanReducesBuffer ] : [] )
    ], configBuffer, 48 );

    if ( DEBUG_REDUCE_BUFFERS ) {
      LOG && logger.logIndexed( encoder, debugSplitScanReducesBuffer, 'debugSplitScanReduces', RasterSplitReduceData );
    }
    LOG && logger.logIndexed( encoder, reducibleChunksBuffer, 'reducibleChunks (no indices)', RasterChunk, () => reducibleChunkCount );
    LOG && logger.logIndexed( encoder, completeChunksBuffer, 'completeChunks (no indices)', RasterCompleteChunk, () => completeChunkCount );
    LOG && logger.logIndexed( encoder, chunkIndexMapBuffer, 'chunkIndexMap', BufferLogger.RasterU32 );

    const reducibleEdgesBuffer = deviceContext.createBuffer( RasterEdge.ENCODING_BYTE_LENGTH * numEdgeClips );
    const completeEdgesBuffer = deviceContext.createBuffer( RasterCompleteEdge.ENCODING_BYTE_LENGTH * MAX_COMPLETE_EDGES );
    const chunkIndicesBuffer = deviceContext.createBuffer( 4 * 2 * numClippedChunks );

    edgeScanShader.dispatchIndirect( encoder, [
      configBuffer,
      clippedChunksBuffer,
      edgeClipsBuffer,
      edgeReduces0Buffer,
      edgeReduces1Buffer,
      edgeReduces2Buffer,
      reducibleEdgesBuffer,
      completeEdgesBuffer,
      chunkIndicesBuffer
    ], configBuffer, 60 );

    LOG && logger.logIndexed( encoder, reducibleEdgesBuffer, 'reducibleEdges (unmapped chunks)', RasterEdge, () => reducibleEdgeCount );
    LOG && logger.logIndexed( encoder, completeEdgesBuffer, 'completeEdges', RasterCompleteEdge, () => completeEdgeCount );
    LOG && logger.logIndexed( encoder, chunkIndicesBuffer, 'chunkIndices', BufferLogger.RasterU32 );

    chunkIndexPatchShader.dispatchIndirect( encoder, [
      configBuffer,
      chunkIndexMapBuffer,
      chunkIndicesBuffer,
      clippedChunksBuffer,
      reducibleChunksBuffer,
      completeChunksBuffer
    ], configBuffer, 48 );

    LOG && logger.logIndexed( encoder, reducibleChunksBuffer, 'reducibleChunks', RasterChunk, () => reducibleChunkCount );
    LOG && logger.logIndexed( encoder, completeChunksBuffer, 'completeChunks', RasterCompleteChunk, () => completeChunkCount );

    uniformUpdateShader.dispatch( encoder, [
      splitReduces2Buffer,
      edgeReduces2Buffer,
      configBuffer
    ], 1, 1, 1 );

    LOG && logger.logIndexed( encoder, configBuffer, 'config', BufferLogger.RasterU32 );

    edgeIndexPatchShader.dispatchIndirect( encoder, [
      configBuffer,
      chunkIndexMapBuffer,
      chunkIndicesBuffer,
      reducibleEdgesBuffer
    ], configBuffer, 12 );

    LOG && logger.logIndexed( encoder, reducibleEdgesBuffer, 'reducibleEdges', RasterEdge, () => reducibleEdgeCount );
    // LOG && logger.logIndexed( encoder, completeEdgesBuffer, 'completeEdges', RasterCompleteEdge, () => completeEdgeCount );

    const commandBuffer = encoder.finish();
    device.queue.submit( [ commandBuffer ] );

    const startTime = Date.now();

    device.queue.onSubmittedWorkDone().then( async () => {
      const endTime = Date.now();

      console.log( endTime - startTime );

      await logger.complete();
    } ).catch( err => {
      throw err;
    } );

    configBuffer.destroy();
    zeroBuffer.destroy();
    oneBuffer.destroy();
    twoBuffer.destroy();
    threeBuffer.destroy();
    clippedChunksBuffer.destroy();
    edgeClipsBuffer.destroy();
    chunkReduces0Buffer.destroy();
    debugChunkReduces0Buffer.destroy();
    chunkReduces1Buffer.destroy();
    chunkReduces2Buffer.destroy();
    splitReduces0Buffer.destroy();
    debugInitialSplitReduceBuffer.destroy();
    edgeReduces0Buffer.destroy();
    debugInitialEdgeReduceBuffer.destroy();
    splitReduces1Buffer.destroy();
    splitReduces2Buffer.destroy();
    edgeReduces1Buffer.destroy();
    edgeReduces2Buffer.destroy();
    reducibleChunksBuffer.destroy();
    completeChunksBuffer.destroy();
    chunkIndexMapBuffer.destroy();
    debugSplitScanReducesBuffer.destroy();
    reducibleEdgesBuffer.destroy();
    completeEdgesBuffer.destroy();
    chunkIndicesBuffer.destroy();
  }

  public static async process(
    workgroupSize: number,
    numInputChunks: number,
    numInputEdges: number,

    // input
    inputChunks: ParallelStorageArray<RasterChunk>,
    inputEdges: ParallelStorageArray<RasterEdge>
  ): Promise<{
    reducibleChunks: ParallelStorageArray<RasterChunk>;
    reducibleEdges: ParallelStorageArray<RasterEdge>;
    numReducibleChunks: number;
    numReducibleEdges: number;

    completeChunks: ParallelStorageArray<RasterCompleteChunk>;
    completeEdges: ParallelStorageArray<RasterCompleteEdge>;
    numCompleteChunks: number;
    numCompleteEdges: number;
  }> {
    assert && RasterChunk.validate( inputChunks, inputEdges, numInputChunks, numInputEdges );

    // For now, we have a binary split
    const numClippedChunks = 2 * numInputChunks;
    const numEdgeClips = 2 * numInputEdges;

    const toIndexedString = ( n: { toString(): string }, i: number ) => `${i} ${n.toString()}`;

    const createStorage = <T>( length: number, indeterminateValue: T ) => new ParallelStorageArray(
      _.range( 0, ByteEncoder.alignUp( length, workgroupSize ) ).map( () => indeterminateValue ),
      indeterminateValue
    );

    LOG && console.log( `numInputChunks: ${numInputChunks}` );
    LOG && console.log( inputChunks.data.slice( 0, numInputChunks ).map( toIndexedString ).join( '\n' ) );

    LOG && console.log( `numInputEdges: ${numInputEdges}` );
    LOG && console.log( inputEdges.data.slice( 0, numInputEdges ).map( toIndexedString ).join( '\n' ) );

    const clippedChunks = createStorage( numClippedChunks, RasterClippedChunk.INDETERMINATE );

    LOG && console.log( 'ParallelRasterInitialChunk dispatch' );
    await ParallelRasterInitialChunk.dispatch(
      workgroupSize,
      inputChunks,
      numInputChunks,
      clippedChunks
    );

    LOG && console.log( 'clippedChunks (without reduce)' );
    LOG && console.log( clippedChunks.data.slice( 0, numClippedChunks ).map( toIndexedString ).join( '\n' ) );

    const edgeClips = createStorage( numEdgeClips, RasterEdgeClip.INDETERMINATE );
    const chunkReduces0 = createStorage( Math.ceil( numInputEdges / workgroupSize ), RasterChunkReduceQuad.INDETERMINATE );
    const debugFullChunkReduces = createStorage( numInputEdges, RasterChunkReducePair.INDETERMINATE );

    LOG && console.log( 'ParallelRasterInitialClip dispatch' );
    await ParallelRasterInitialClip.dispatch(
      workgroupSize,
      inputChunks, inputEdges,
      numInputEdges,
      clippedChunks,
      edgeClips, chunkReduces0, debugFullChunkReduces
    );

    LOG && console.log( 'edgeClips' );
    LOG && console.log( edgeClips.data.slice( 0, numEdgeClips ).map( toIndexedString ).join( '\n' ) );

    LOG && console.log( 'debugFullChunkReduces' );
    LOG && console.log( debugFullChunkReduces.data.slice( 0, numInputEdges ).flatMap( ( n, i ) => [
      `${i} min: ${n.min.toString()}`,
      `${i.toString().replace( /./g, ' ' )} max: ${n.max.toString()}`
    ] ).join( '\n' ) );

    LOG && console.log( 'chunkReduces0' );
    LOG && console.log( chunkReduces0.data.slice( 0, Math.ceil( numInputEdges / workgroupSize ) ).flatMap( ( n, i ) => [
      `${i} leftMin: ${n.leftMin.toString()}`,
      `${i.toString().replace( /./g, ' ' )} rightMin: ${n.rightMin.toString()}`,
      `${i.toString().replace( /./g, ' ' )} leftMax: ${n.leftMax.toString()}`,
      `${i.toString().replace( /./g, ' ' )} rightMax: ${n.rightMax.toString()}`
    ] ).join( '\n' ) );

    const chunkReduces1 = createStorage( Math.ceil( numInputEdges / ( workgroupSize * workgroupSize ) ), RasterChunkReduceQuad.INDETERMINATE );

    LOG && console.log( 'ParallelRasterChunkReduce dispatch' );
    await ParallelRasterChunkReduce.dispatch(
      workgroupSize,
      chunkReduces0,
      Math.ceil( numInputEdges / workgroupSize ),
      clippedChunks,
      chunkReduces1
    );

    LOG && console.log( 'chunkReduces1' );
    LOG && console.log( chunkReduces1.data.slice( 0, Math.ceil( numInputEdges / ( workgroupSize * workgroupSize ) ) ).flatMap( ( n, i ) => [
      `${i} leftMin: ${n.leftMin.toString()}`,
      `${i.toString().replace( /./g, ' ' )} rightMin: ${n.rightMin.toString()}`,
      `${i.toString().replace( /./g, ' ' )} leftMax: ${n.leftMax.toString()}`,
      `${i.toString().replace( /./g, ' ' )} rightMax: ${n.rightMax.toString()}`
    ] ).join( '\n' ) );

    const chunkReduces2 = createStorage( Math.ceil( numInputEdges / ( workgroupSize * workgroupSize * workgroupSize ) ), RasterChunkReduceQuad.INDETERMINATE );

    LOG && console.log( 'ParallelRasterChunkReduce dispatch' );
    await ParallelRasterChunkReduce.dispatch(
      workgroupSize,
      chunkReduces1,
      Math.ceil( numInputEdges / ( workgroupSize * workgroupSize ) ),
      clippedChunks,
      chunkReduces2
    );

    LOG && console.log( 'chunkReduces2' );
    LOG && console.log( chunkReduces2.data.slice( 0, Math.ceil( numInputEdges / ( workgroupSize * workgroupSize * workgroupSize ) ) ).flatMap( ( n, i ) => [
      `${i} leftMin: ${n.leftMin.toString()}`,
      `${i.toString().replace( /./g, ' ' )} rightMin: ${n.rightMin.toString()}`,
      `${i.toString().replace( /./g, ' ' )} leftMax: ${n.leftMax.toString()}`,
      `${i.toString().replace( /./g, ' ' )} rightMax: ${n.rightMax.toString()}`
    ] ).join( '\n' ) );

    LOG && console.log( 'clippedChunks (with reduce)' );
    LOG && console.log( clippedChunks.data.slice( 0, numClippedChunks ).map( toIndexedString ).join( '\n' ) );

    /*
     * "split" reduce/scan, to distribute the chunks into reducibleChunks/completeChunks
     */

    const debugFullSplitReduces = createStorage( numClippedChunks, RasterSplitReduceData.INDETERMINATE );
    const splitReduces0 = createStorage( Math.ceil( numClippedChunks / workgroupSize ), RasterSplitReduceData.INDETERMINATE );

    LOG && console.log( 'ParallelRasterInitialSplitReduce dispatch' );
    await ParallelRasterInitialSplitReduce.dispatch(
      workgroupSize,
      clippedChunks,
      numClippedChunks,
      debugFullSplitReduces, splitReduces0
    );

    LOG && console.log( 'debugFullSplitReduces' );
    LOG && console.log( debugFullSplitReduces.data.slice( 0, numClippedChunks ).map( toIndexedString ).join( '\n' ) );

    LOG && console.log( 'splitReduces0 (reduced)' );
    LOG && console.log( splitReduces0.data.slice( 0, Math.ceil( numClippedChunks / workgroupSize ) ).map( toIndexedString ).join( '\n' ) );

    const splitReduces1 = createStorage( Math.ceil( numClippedChunks / ( workgroupSize * workgroupSize ) ), RasterSplitReduceData.INDETERMINATE );

    LOG && console.log( 'ParallelRasterSplitReduce dispatch' );
    await ParallelRasterSplitReduce.dispatch(
      workgroupSize,
      Math.ceil( numClippedChunks / workgroupSize ),
      splitReduces0,
      splitReduces1
    );

    LOG && console.log( 'splitReduces0 (scanned)' );
    LOG && console.log( splitReduces0.data.slice( 0, Math.ceil( numClippedChunks / workgroupSize ) ).map( toIndexedString ).join( '\n' ) );

    LOG && console.log( 'splitReduces1 (reduced)' );
    LOG && console.log( splitReduces1.data.slice( 0, Math.ceil( numClippedChunks / ( workgroupSize * workgroupSize ) ) ).map( toIndexedString ).join( '\n' ) );

    const splitReduces2 = createStorage( Math.ceil( numClippedChunks / ( workgroupSize * workgroupSize * workgroupSize ) ), RasterSplitReduceData.INDETERMINATE );

    LOG && console.log( 'ParallelRasterSplitReduce dispatch' );
    await ParallelRasterSplitReduce.dispatch(
      workgroupSize,
      Math.ceil( numClippedChunks / ( workgroupSize * workgroupSize ) ),
      splitReduces1,
      splitReduces2
    );

    LOG && console.log( 'splitReduces1 (scanned)' );
    LOG && console.log( splitReduces1.data.slice( 0, Math.ceil( numClippedChunks / ( workgroupSize * workgroupSize ) ) ).map( toIndexedString ).join( '\n' ) );

    LOG && console.log( 'splitReduces2 (reduced)' );
    LOG && console.log( splitReduces2.data.slice( 0, Math.ceil( numClippedChunks / ( workgroupSize * workgroupSize * workgroupSize ) ) ).map( toIndexedString ).join( '\n' ) );

    assert && assert( Math.ceil( numClippedChunks / ( workgroupSize * workgroupSize * workgroupSize ) ) === 1 );

    const reducibleChunkCount = splitReduces2.data[ 0 ].numReducible;
    const completeChunkCount = splitReduces2.data[ 0 ].numComplete;

    const reducibleChunks = createStorage( reducibleChunkCount, RasterChunk.INDETERMINATE );
    const completeChunks = createStorage( completeChunkCount, RasterCompleteChunk.INDETERMINATE );
    const chunkIndexMap = createStorage( numClippedChunks, NaN );

    const debugSplitScanReduces = createStorage( numClippedChunks, RasterSplitReduceData.INDETERMINATE );

    LOG && console.log( 'ParallelRasterSplitScan dispatch' );
    await ParallelRasterSplitScan.dispatch(
      workgroupSize,
      clippedChunks, splitReduces0, splitReduces1, splitReduces2,
      numClippedChunks,
      reducibleChunks, completeChunks, chunkIndexMap, debugSplitScanReduces
    );

    LOG && console.log( 'debugSplitScanReduces' );
    LOG && console.log( debugSplitScanReduces.data.slice( 0, numClippedChunks ).map( toIndexedString ).join( '\n' ) );

    LOG && console.log( `reducibleChunks ${reducibleChunkCount}` );
    LOG && console.log( reducibleChunks.data.slice( 0, reducibleChunkCount ).map( toIndexedString ).join( '\n' ) );

    LOG && console.log( `completeChunks ${completeChunkCount}` );
    LOG && console.log( completeChunks.data.slice( 0, completeChunkCount ).map( toIndexedString ).join( '\n' ) );

    LOG && console.log( 'chunkIndexMap' );
    LOG && console.log( chunkIndexMap.data.slice( 0, numClippedChunks ).map( toIndexedString ).join( '\n' ) );

    /*
     * "edge" reduce/scan, to distribute the edges into reducibleEdges/completeEdges
     */

    const debugFullEdgeReduces = createStorage( numEdgeClips, RasterSplitReduceData.INDETERMINATE );
    const edgeReduces0 = createStorage( Math.ceil( numEdgeClips / workgroupSize ), RasterSplitReduceData.INDETERMINATE );

    LOG && console.log( 'ParallelRasterInitialEdgeReduce dispatch' );
    await ParallelRasterInitialEdgeReduce.dispatch(
      workgroupSize,
      clippedChunks, edgeClips,
      numEdgeClips,
      debugFullEdgeReduces, edgeReduces0
    );

    LOG && console.log( 'debugFullEdgeReduces' );
    LOG && console.log( debugFullEdgeReduces.data.slice( 0, numEdgeClips ).map( toIndexedString ).join( '\n' ) );

    LOG && console.log( 'edgeReduces0 (reduced)' );
    LOG && console.log( edgeReduces0.data.slice( 0, Math.ceil( numEdgeClips / workgroupSize ) ).map( toIndexedString ).join( '\n' ) );

    const edgeReduces1 = createStorage( Math.ceil( numEdgeClips / ( workgroupSize * workgroupSize ) ), RasterSplitReduceData.INDETERMINATE );

    LOG && console.log( 'ParallelRasterSplitReduce dispatch' );
    await ParallelRasterSplitReduce.dispatch(
      workgroupSize,
      Math.ceil( numEdgeClips / workgroupSize ),
      edgeReduces0,
      edgeReduces1
    );

    LOG && console.log( 'edgeReduces0 (scanned)' );
    LOG && console.log( edgeReduces0.data.slice( 0, Math.ceil( numEdgeClips / workgroupSize ) ).map( toIndexedString ).join( '\n' ) );

    LOG && console.log( 'edgeReduces1 (reduced)' );
    LOG && console.log( edgeReduces1.data.slice( 0, Math.ceil( numEdgeClips / ( workgroupSize * workgroupSize ) ) ).map( toIndexedString ).join( '\n' ) );

    const edgeReduces2 = createStorage( Math.ceil( numEdgeClips / ( workgroupSize * workgroupSize * workgroupSize ) ), RasterSplitReduceData.INDETERMINATE );

    LOG && console.log( 'ParallelRasterSplitReduce dispatch' );
    await ParallelRasterSplitReduce.dispatch(
      workgroupSize,
      Math.ceil( numEdgeClips / ( workgroupSize * workgroupSize ) ),
      edgeReduces1,
      edgeReduces2
    );

    LOG && console.log( 'edgeReduces1 (scanned)' );
    LOG && console.log( edgeReduces1.data.slice( 0, Math.ceil( numEdgeClips / ( workgroupSize * workgroupSize ) ) ).map( toIndexedString ).join( '\n' ) );

    LOG && console.log( 'edgeReduces2 (reduced)' );
    LOG && console.log( edgeReduces2.data.slice( 0, Math.ceil( numEdgeClips / ( workgroupSize * workgroupSize * workgroupSize ) ) ).map( toIndexedString ).join( '\n' ) );

    assert && assert( Math.ceil( numEdgeClips / ( workgroupSize * workgroupSize * workgroupSize ) ) === 1 );

    const reducibleEdgeCount = edgeReduces2.data[ 0 ].numReducible;
    const completeEdgeCount = edgeReduces2.data[ 0 ].numComplete;

    const reducibleEdges = createStorage( reducibleEdgeCount, RasterEdge.INDETERMINATE );
    const completeEdges = createStorage( completeEdgeCount, RasterCompleteEdge.INDETERMINATE );
    const chunkIndices = createStorage( numClippedChunks * 2, NaN );
    const debugEdgeScan = createStorage( numEdgeClips, RasterSplitReduceData.INDETERMINATE );

    LOG && console.log( 'ParallelRasterEdgeScan dispatch' );
    await ParallelRasterEdgeScan.dispatch(
      workgroupSize,
      clippedChunks, edgeClips, edgeReduces0, edgeReduces1, edgeReduces2,
      numEdgeClips,
      reducibleEdges, completeEdges, chunkIndices, debugEdgeScan
    );

    LOG && console.log( `reducibleEdges ${reducibleEdgeCount}` );
    LOG && console.log( reducibleEdges.data.slice( 0, reducibleEdgeCount ).map( toIndexedString ).join( '\n' ) );

    LOG && console.log( `completeEdges ${completeEdgeCount}` );
    LOG && console.log( completeEdges.data.slice( 0, completeEdgeCount ).map( toIndexedString ).join( '\n' ) );

    LOG && console.log( 'chunkIndices' );
    // each has a min/max!
    LOG && console.log( chunkIndices.data.slice( 0, numClippedChunks * 2 ).map( toIndexedString ).join( '\n' ) );

    LOG && console.log( 'debugEdgeScan' );
    LOG && console.log( debugEdgeScan.data.slice( 0, numEdgeClips ).map( toIndexedString ).join( '\n' ) );

    LOG && console.log( 'ParallelRasterChunkIndexPatch dispatch' );
    await ParallelRasterChunkIndexPatch.dispatch(
      workgroupSize,
      chunkIndexMap, chunkIndices, clippedChunks,
      numClippedChunks,
      reducibleChunks, completeChunks
    );

    LOG && console.log( `reducibleChunks ${reducibleChunkCount}` );
    LOG && console.log( reducibleChunks.data.slice( 0, reducibleChunkCount ).map( toIndexedString ).join( '\n' ) );

    LOG && console.log( `completeChunks ${completeChunkCount}` );
    LOG && console.log( completeChunks.data.slice( 0, completeChunkCount ).map( toIndexedString ).join( '\n' ) );

    LOG && console.log( 'ParallelRasterEdgeIndexPatch dispatch' );
    await ParallelRasterEdgeIndexPatch.dispatch(
      workgroupSize,
      chunkIndexMap, chunkIndices,
      reducibleEdgeCount,
      reducibleEdges
    );

    LOG && console.log( `reducibleEdges ${reducibleEdgeCount}` );
    LOG && console.log( reducibleEdges.data.slice( 0, reducibleEdgeCount ).map( toIndexedString ).join( '\n' ) );

    LOG && console.log( `completeEdges ${completeEdgeCount}` );
    LOG && console.log( completeEdges.data.slice( 0, completeEdgeCount ).map( toIndexedString ).join( '\n' ) );

    assert && RasterChunk.validate( reducibleChunks, reducibleEdges, reducibleChunkCount, reducibleEdgeCount );
    assert && RasterCompleteChunk.validate( completeChunks, completeEdges, completeChunkCount, completeEdgeCount );

    return {
      reducibleChunks: reducibleChunks,
      reducibleEdges: reducibleEdges,
      numReducibleChunks: reducibleChunkCount,
      numReducibleEdges: reducibleEdgeCount,

      completeChunks: completeChunks,
      completeEdges: completeEdges,
      numCompleteChunks: completeChunkCount,
      numCompleteEdges: completeEdgeCount
    };
  }
}

alpenglow.register( 'ParallelRaster', ParallelRaster );
