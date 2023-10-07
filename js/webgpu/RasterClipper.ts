// Copyright 2023, University of Colorado Boulder

/**
 * Rasterization prototype for WebGPU, but using the parallel (debuggable) API.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, Binding, BufferLogger, ByteEncoder, ComputeShader, DeviceContext, ParallelRaster, RasterChunk, RasterChunkReducePair, RasterChunkReduceQuad, RasterClippedChunk, RasterCompleteChunk, RasterCompleteEdge, RasterEdge, RasterEdgeClip, RasterSplitReduceData, wgsl_raster_chunk_index_patch, wgsl_raster_chunk_reduce, wgsl_raster_edge_index_patch, wgsl_raster_edge_scan, wgsl_raster_initial_chunk, wgsl_raster_initial_clip, wgsl_raster_initial_edge_reduce, wgsl_raster_initial_split_reduce, wgsl_raster_split_reduce, wgsl_raster_split_scan, wgsl_raster_uniform_update } from '../imports.js';

// TODO: move to 256 after testing (64 helps us test more cases here)
// const WORKGROUP_SIZE = 64;
// const LOG = false;
// const USE_DEMO = true;
// const ONLY_FIRST_ITERATION = false;

const WORKGROUP_SIZE = 4;
const LOG = true;
// const USE_DEMO = false;
// const ONLY_FIRST_ITERATION = true;
const DEBUG_REDUCE_BUFFERS = false;


// TODO: figure out better output buffer size, since it's hard to bound
const MAX_EXPONENT = 19;
const MAX_COMPLETE_CHUNKS = 2 ** MAX_EXPONENT;
const MAX_COMPLETE_EDGES = 2 ** MAX_EXPONENT;

const MAX_CHUNKS = 2 ** MAX_EXPONENT;
const MAX_EDGES = 2 ** MAX_EXPONENT;
const MAX_CLIPPED_CHUNKS = 2 * MAX_CHUNKS;
const MAX_EDGE_CLIPS = 2 * MAX_EDGES;

// TODO: better name
export default class RasterClipper {

  private readonly device: GPUDevice;

  private readonly logger: BufferLogger;

  private readonly zeroBuffer: GPUBuffer;
  private readonly oneBuffer: GPUBuffer;
  private readonly twoBuffer: GPUBuffer;
  private readonly threeBuffer: GPUBuffer;

  private readonly initialChunksShader: ComputeShader;
  private readonly initialClipShader: ComputeShader;
  private readonly chunkReduceShader: ComputeShader;
  private readonly initialSplitReduceShader: ComputeShader;
  private readonly initialEdgeReduceShader: ComputeShader;
  private readonly splitReduceShader: ComputeShader;
  private readonly splitScanShader: ComputeShader;
  private readonly edgeScanShader: ComputeShader;
  private readonly chunkIndexPatchShader: ComputeShader;
  private readonly uniformUpdateShader: ComputeShader;
  private readonly edgeIndexPatchShader: ComputeShader;

  public constructor( private readonly deviceContext: DeviceContext ) {
    this.device = deviceContext.device;

    this.logger = new BufferLogger( deviceContext );

    this.zeroBuffer = this.device.createBuffer( { size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST } );
    this.device.queue.writeBuffer( this.zeroBuffer, 0, new Uint32Array( [ 0, 0, 0, 0 ] ).buffer );

    this.oneBuffer = this.device.createBuffer( { size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST } );
    this.device.queue.writeBuffer( this.oneBuffer, 0, new Uint32Array( [ 1, 1, 1, 1 ] ).buffer );

    this.twoBuffer = this.device.createBuffer( { size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST } );
    this.device.queue.writeBuffer( this.twoBuffer, 0, new Uint32Array( [ 2, 2, 2, 2 ] ).buffer );

    this.threeBuffer = this.device.createBuffer( { size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST } );
    this.device.queue.writeBuffer( this.threeBuffer, 0, new Uint32Array( [ 3, 3, 3, 3 ] ).buffer );

    const workgroupSize = WORKGROUP_SIZE;

    const shaderOptions = {
      workgroupSize: workgroupSize,
      debugReduceBuffers: DEBUG_REDUCE_BUFFERS
    } as const;

    this.initialChunksShader = ComputeShader.fromSource( this.device, 'initial_chunks', wgsl_raster_initial_chunk, [
      Binding.UNIFORM_BUFFER,
      Binding.READ_ONLY_STORAGE_BUFFER,
      Binding.STORAGE_BUFFER
    ], shaderOptions );

    this.initialClipShader = ComputeShader.fromSource( this.device, 'initial_clip', wgsl_raster_initial_clip, [
      Binding.UNIFORM_BUFFER,
      Binding.READ_ONLY_STORAGE_BUFFER,
      Binding.READ_ONLY_STORAGE_BUFFER,
      Binding.STORAGE_BUFFER,
      Binding.STORAGE_BUFFER,
      Binding.STORAGE_BUFFER,
      ...( DEBUG_REDUCE_BUFFERS ? [ Binding.STORAGE_BUFFER ] : [] )
    ], shaderOptions );

    this.chunkReduceShader = ComputeShader.fromSource( this.device, 'chunk_reduce', wgsl_raster_chunk_reduce, [
      Binding.UNIFORM_BUFFER,
      Binding.UNIFORM_BUFFER,
      Binding.READ_ONLY_STORAGE_BUFFER,
      Binding.STORAGE_BUFFER,
      Binding.STORAGE_BUFFER
    ], shaderOptions );

    this.initialSplitReduceShader = ComputeShader.fromSource( this.device, 'initial_split_reduce', wgsl_raster_initial_split_reduce, [
      Binding.UNIFORM_BUFFER,
      Binding.READ_ONLY_STORAGE_BUFFER,
      Binding.STORAGE_BUFFER,
      ...( DEBUG_REDUCE_BUFFERS ? [ Binding.STORAGE_BUFFER ] : [] )
    ], shaderOptions );

    this.initialEdgeReduceShader = ComputeShader.fromSource( this.device, 'initial_edge_reduce', wgsl_raster_initial_edge_reduce, [
      Binding.UNIFORM_BUFFER,
      Binding.READ_ONLY_STORAGE_BUFFER,
      Binding.READ_ONLY_STORAGE_BUFFER,
      Binding.STORAGE_BUFFER,
      ...( DEBUG_REDUCE_BUFFERS ? [ Binding.STORAGE_BUFFER ] : [] )
    ], shaderOptions );

    this.splitReduceShader = ComputeShader.fromSource( this.device, 'split_reduce', wgsl_raster_split_reduce, [
      Binding.UNIFORM_BUFFER,
      Binding.UNIFORM_BUFFER,
      Binding.STORAGE_BUFFER,
      Binding.STORAGE_BUFFER
    ], shaderOptions );

    this.splitScanShader = ComputeShader.fromSource( this.device, 'split_scan', wgsl_raster_split_scan, [
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

    this.edgeScanShader = ComputeShader.fromSource( this.device, 'edge_scan', wgsl_raster_edge_scan, [
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

    this.chunkIndexPatchShader = ComputeShader.fromSource( this.device, 'chunk_index_patch', wgsl_raster_chunk_index_patch, [
      Binding.UNIFORM_BUFFER,
      Binding.READ_ONLY_STORAGE_BUFFER,
      Binding.READ_ONLY_STORAGE_BUFFER,
      Binding.READ_ONLY_STORAGE_BUFFER,
      Binding.STORAGE_BUFFER,
      Binding.STORAGE_BUFFER
    ], shaderOptions );

    this.uniformUpdateShader = ComputeShader.fromSource( this.device, 'uniform_update', wgsl_raster_uniform_update, [
      Binding.READ_ONLY_STORAGE_BUFFER,
      Binding.READ_ONLY_STORAGE_BUFFER,
      Binding.STORAGE_BUFFER
    ], shaderOptions );

    this.edgeIndexPatchShader = ComputeShader.fromSource( this.device, 'edge_index_patch', wgsl_raster_edge_index_patch, [
      Binding.UNIFORM_BUFFER,
      Binding.READ_ONLY_STORAGE_BUFFER,
      Binding.READ_ONLY_STORAGE_BUFFER,
      Binding.STORAGE_BUFFER
    ], shaderOptions );

  }

  public static async test(): Promise<void> {
    const device = ( await DeviceContext.getDevice() )!;
    assert && assert( device );

    const deviceContext = new DeviceContext( device );

    const rasterClipper = new RasterClipper( deviceContext );

// const displaySize = 512;

    const rawInputChunks = ParallelRaster.getTestRawInputChunks();
    const rawInputEdges = ParallelRaster.getTestRawInputEdges();

    const numInputChunks = rawInputChunks.length;
    const numInputEdges = rawInputEdges.length;
    const numClippedChunks = 2 * numInputChunks;
    const numEdgeClips = 2 * numInputEdges;

    const workgroupSize = WORKGROUP_SIZE;

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

    const encoder = device.createCommandEncoder( {
      label: 'the encoder'
    } );

    const stageOutput = rasterClipper.runStage( encoder, configBuffer, inputChunksBuffer, inputEdgesBuffer );

    const commandBuffer = encoder.finish();
    device.queue.submit( [ commandBuffer ] );

    const startTime = Date.now();

    device.queue.onSubmittedWorkDone().then( async () => {
      const endTime = Date.now();

      console.log( endTime - startTime );

      await rasterClipper.logger.complete();
    } ).catch( err => {
      throw err;
    } );

    configBuffer.destroy();
    inputChunksBuffer.destroy();
    inputEdgesBuffer.destroy();
    stageOutput.reducibleChunksBuffer.destroy();
    stageOutput.completeChunksBuffer.destroy();
    stageOutput.reducibleEdgesBuffer.destroy();
    stageOutput.completeEdgesBuffer.destroy();
    stageOutput.temporaryBuffers.forEach( buffer => buffer.destroy() );
  }

  // public run(
  //   encoder: GPUCommandEncoder,
  //   numStages: number
  // ): {
  //
  // } {
  //   throw new Error( 'TODO' );
  // }

  public runStage(
    encoder: GPUCommandEncoder,
    configBuffer: GPUBuffer,
    inputChunksBuffer: GPUBuffer,
    inputEdgesBuffer: GPUBuffer
  ): {
    reducibleChunksBuffer: GPUBuffer;
    completeChunksBuffer: GPUBuffer;
    reducibleEdgesBuffer: GPUBuffer;
    completeEdgesBuffer: GPUBuffer;
    temporaryBuffers: GPUBuffer[];
  } {
    const workgroupSize = WORKGROUP_SIZE;

    let numUsedInputChunks = -1;
    let numUsedInputEdges = -1;
    let numUsedClippedChunks = -1;
    let numUsedEdgeClips = -1;

    LOG && this.logger.withBuffer( encoder, configBuffer, async arrayBuffer => {
      numUsedInputChunks = new Uint32Array( arrayBuffer )[ 30 ];
      numUsedInputEdges = new Uint32Array( arrayBuffer )[ 31 ];
      numUsedClippedChunks = new Uint32Array( arrayBuffer )[ 32 ];
      numUsedEdgeClips = new Uint32Array( arrayBuffer )[ 33 ];
    } );

    LOG && this.logger.logIndexed( encoder, inputChunksBuffer, 'inputChunks', RasterChunk, () => numUsedInputChunks );
    LOG && this.logger.logIndexed( encoder, inputEdgesBuffer, 'inputEdges', RasterEdge, () => numUsedInputEdges );

    const clippedChunksBuffer = this.deviceContext.createBuffer( RasterClippedChunk.ENCODING_BYTE_LENGTH * MAX_CLIPPED_CHUNKS );

    this.initialChunksShader.dispatchIndirect( encoder, [
      configBuffer,
      inputChunksBuffer,
      clippedChunksBuffer
    ], configBuffer, 0 );

    LOG && this.logger.logIndexed( encoder, clippedChunksBuffer, 'clippedChunks (initial)', RasterClippedChunk, () => numUsedClippedChunks );

    const edgeClipsBuffer = this.deviceContext.createBuffer( RasterEdgeClip.ENCODING_BYTE_LENGTH * MAX_EDGE_CLIPS );
    const chunkReduces0Buffer = this.deviceContext.createBuffer( RasterChunkReduceQuad.ENCODING_BYTE_LENGTH * Math.ceil( MAX_EDGES / workgroupSize ) );
    const debugChunkReduces0Buffer = this.deviceContext.createBuffer( RasterChunkReducePair.ENCODING_BYTE_LENGTH * MAX_EDGES );

    this.initialClipShader.dispatchIndirect( encoder, [
      configBuffer,
      inputChunksBuffer,
      inputEdgesBuffer,
      clippedChunksBuffer,
      edgeClipsBuffer,
      chunkReduces0Buffer,
      ...( DEBUG_REDUCE_BUFFERS ? [ debugChunkReduces0Buffer ] : [] )
    ], configBuffer, 12 );

    LOG && this.logger.logIndexed( encoder, edgeClipsBuffer, 'edgeClips', RasterEdgeClip, () => numUsedEdgeClips );
    LOG && this.logger.logIndexedMultiline( encoder, chunkReduces0Buffer, 'chunkReduces0', RasterChunkReduceQuad, () => Math.ceil( numUsedInputEdges / workgroupSize ) );
    if ( DEBUG_REDUCE_BUFFERS ) {
      LOG && this.logger.logIndexedMultiline( encoder, debugChunkReduces0Buffer, 'debugFullChunkReduces', RasterChunkReducePair, () => numUsedInputEdges );
    }

    const chunkReduces1Buffer = this.deviceContext.createBuffer( RasterChunkReduceQuad.ENCODING_BYTE_LENGTH * Math.ceil( MAX_EDGES / ( workgroupSize * workgroupSize ) ) );

    this.chunkReduceShader.dispatchIndirect( encoder, [
      configBuffer,
      this.zeroBuffer, // signify our "first" chunkReduce
      chunkReduces0Buffer,
      clippedChunksBuffer,
      chunkReduces1Buffer
    ], configBuffer, 24 );

    LOG && this.logger.logIndexedMultiline( encoder, chunkReduces1Buffer, 'chunkReduces1', RasterChunkReduceQuad, () => Math.ceil( numUsedInputEdges / ( workgroupSize * workgroupSize ) ) );

    // TODO: don't even have these buffers! We probably need a second shader for that, no?
    const chunkReduces2Buffer = this.deviceContext.createBuffer( RasterChunkReduceQuad.ENCODING_BYTE_LENGTH * Math.ceil( MAX_EDGES / ( workgroupSize * workgroupSize * workgroupSize ) ) );

    this.chunkReduceShader.dispatchIndirect( encoder, [
      configBuffer,
      this.oneBuffer, // signify our "second" chunkReduce
      chunkReduces1Buffer,
      clippedChunksBuffer,
      chunkReduces2Buffer
    ], configBuffer, 36 );

    LOG && this.logger.logIndexedMultiline( encoder, chunkReduces2Buffer, 'chunkReduces2', RasterChunkReduceQuad, () => Math.ceil( numUsedInputEdges / ( workgroupSize * workgroupSize * workgroupSize ) ) );
    LOG && this.logger.logIndexed( encoder, clippedChunksBuffer, 'clippedChunks (reduced)', RasterClippedChunk, () => numUsedClippedChunks );

    const splitReduces0Buffer = this.deviceContext.createBuffer( RasterSplitReduceData.ENCODING_BYTE_LENGTH * Math.ceil( MAX_CLIPPED_CHUNKS / workgroupSize ) );
    const debugInitialSplitReduceBuffer = this.deviceContext.createBuffer( RasterSplitReduceData.ENCODING_BYTE_LENGTH * MAX_CLIPPED_CHUNKS );

    this.initialSplitReduceShader.dispatchIndirect( encoder, [
      configBuffer,
      clippedChunksBuffer,
      splitReduces0Buffer,
      ...( DEBUG_REDUCE_BUFFERS ? [ debugInitialSplitReduceBuffer ] : [] )
    ], configBuffer, 48 );

    const edgeReduces0Buffer = this.deviceContext.createBuffer( RasterSplitReduceData.ENCODING_BYTE_LENGTH * Math.ceil( MAX_EDGE_CLIPS / workgroupSize ) );
    const debugInitialEdgeReduceBuffer = this.deviceContext.createBuffer( RasterSplitReduceData.ENCODING_BYTE_LENGTH * MAX_EDGE_CLIPS );

    this.initialEdgeReduceShader.dispatchIndirect( encoder, [
      configBuffer,
      clippedChunksBuffer,
      edgeClipsBuffer,
      edgeReduces0Buffer,
      ...( DEBUG_REDUCE_BUFFERS ? [ debugInitialEdgeReduceBuffer ] : [] )
    ], configBuffer, 60 );

    const splitReduces1Buffer = this.deviceContext.createBuffer( RasterSplitReduceData.ENCODING_BYTE_LENGTH * Math.ceil( MAX_CLIPPED_CHUNKS / ( workgroupSize * workgroupSize ) ) );

    if ( DEBUG_REDUCE_BUFFERS ) {
      LOG && this.logger.logIndexed( encoder, debugInitialSplitReduceBuffer, 'debugInitialSplitReduce', RasterSplitReduceData, () => numUsedClippedChunks );
    }
    LOG && this.logger.logIndexed( encoder, splitReduces0Buffer, 'splitReduces0', RasterSplitReduceData, () => Math.ceil( numUsedClippedChunks / workgroupSize ) );

    this.splitReduceShader.dispatchIndirect( encoder, [
      configBuffer,
      this.zeroBuffer, // signify our split0 splitReduce
      splitReduces0Buffer,
      splitReduces1Buffer
    ], configBuffer, 72 );

    LOG && this.logger.logIndexed( encoder, splitReduces0Buffer, 'splitReduces0 (scanned)', RasterSplitReduceData, () => Math.ceil( numUsedClippedChunks / workgroupSize ) );
    LOG && this.logger.logIndexed( encoder, splitReduces1Buffer, 'splitReduces1', RasterSplitReduceData, () => Math.ceil( numUsedClippedChunks / ( workgroupSize * workgroupSize ) ) );

    const splitReduces2Buffer = this.deviceContext.createBuffer( RasterSplitReduceData.ENCODING_BYTE_LENGTH * Math.ceil( MAX_CLIPPED_CHUNKS / ( workgroupSize * workgroupSize * workgroupSize ) ) );

    this.splitReduceShader.dispatchIndirect( encoder, [
      configBuffer,
      this.oneBuffer, // signify our split1 splitReduce
      splitReduces1Buffer,
      splitReduces2Buffer
    ], configBuffer, 84 );

    LOG && this.logger.logIndexed( encoder, splitReduces1Buffer, 'splitReduces1 (scanned)', RasterSplitReduceData, () => Math.ceil( numUsedClippedChunks / ( workgroupSize * workgroupSize ) ) );
    LOG && this.logger.logIndexed( encoder, splitReduces2Buffer, 'splitReduces2', RasterSplitReduceData, () => Math.ceil( numUsedClippedChunks / ( workgroupSize * workgroupSize * workgroupSize ) ) );

    let reducibleChunkCount = -1;
    let completeChunkCount = -1;

    LOG && this.logger.withBuffer( encoder, splitReduces2Buffer, async arrayBuffer => {
      reducibleChunkCount = new Uint32Array( arrayBuffer )[ 0 ];
      completeChunkCount = new Uint32Array( arrayBuffer )[ 1 ];
    } );

    const edgeReduces1Buffer = this.deviceContext.createBuffer( RasterSplitReduceData.ENCODING_BYTE_LENGTH * Math.ceil( MAX_EDGE_CLIPS / ( workgroupSize * workgroupSize ) ) );

    if ( DEBUG_REDUCE_BUFFERS ) {
      LOG && this.logger.logIndexed( encoder, debugInitialEdgeReduceBuffer, 'debugInitialEdgeReduce', RasterSplitReduceData, () => numUsedEdgeClips );
    }
    LOG && this.logger.logIndexed( encoder, edgeReduces0Buffer, 'edgeReduces0', RasterSplitReduceData, () => Math.ceil( numUsedEdgeClips / workgroupSize ) );

    this.splitReduceShader.dispatchIndirect( encoder, [
      configBuffer,
      this.twoBuffer, // signify our edge0 splitReduce
      edgeReduces0Buffer,
      edgeReduces1Buffer
    ], configBuffer, 96 );

    LOG && this.logger.logIndexed( encoder, edgeReduces0Buffer, 'edgeReduces0 (scanned)', RasterSplitReduceData, () => Math.ceil( numUsedEdgeClips / workgroupSize ) );
    LOG && this.logger.logIndexed( encoder, edgeReduces1Buffer, 'edgeReduces1', RasterSplitReduceData, () => Math.ceil( numUsedEdgeClips / ( workgroupSize * workgroupSize ) ) );

    const edgeReduces2Buffer = this.deviceContext.createBuffer( RasterSplitReduceData.ENCODING_BYTE_LENGTH * Math.ceil( MAX_EDGE_CLIPS / ( workgroupSize * workgroupSize * workgroupSize ) ) );

    this.splitReduceShader.dispatchIndirect( encoder, [
      configBuffer,
      this.threeBuffer, // signify our edge1 splitReduce
      edgeReduces1Buffer,
      edgeReduces2Buffer
    ], configBuffer, 108 );

    LOG && this.logger.logIndexed( encoder, edgeReduces1Buffer, 'edgeReduces1 (scanned)', RasterSplitReduceData, () => Math.ceil( numUsedEdgeClips / ( workgroupSize * workgroupSize ) ) );
    LOG && this.logger.logIndexed( encoder, edgeReduces2Buffer, 'edgeReduces2', RasterSplitReduceData, () => Math.ceil( numUsedEdgeClips / ( workgroupSize * workgroupSize * workgroupSize ) ) );

    let reducibleEdgeCount = -1;
    let completeEdgeCount = -1;

    LOG && this.logger.withBuffer( encoder, edgeReduces2Buffer, async arrayBuffer => {
      reducibleEdgeCount = new Uint32Array( arrayBuffer )[ 0 ];
      completeEdgeCount = new Uint32Array( arrayBuffer )[ 1 ];
    } );

    const reducibleChunksBuffer = this.deviceContext.createBuffer( RasterChunk.ENCODING_BYTE_LENGTH * MAX_CLIPPED_CHUNKS );
    const completeChunksBuffer = this.deviceContext.createBuffer( RasterCompleteChunk.ENCODING_BYTE_LENGTH * MAX_COMPLETE_CHUNKS );
    const chunkIndexMapBuffer = this.deviceContext.createBuffer( 4 * MAX_CLIPPED_CHUNKS );
    const debugSplitScanReducesBuffer = this.deviceContext.createBuffer( RasterSplitReduceData.ENCODING_BYTE_LENGTH * MAX_CLIPPED_CHUNKS );

    this.splitScanShader.dispatchIndirect( encoder, [
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
      LOG && this.logger.logIndexed( encoder, debugSplitScanReducesBuffer, 'debugSplitScanReduces', RasterSplitReduceData, () => numUsedClippedChunks );
    }
    LOG && this.logger.logIndexed( encoder, reducibleChunksBuffer, 'reducibleChunks (no indices)', RasterChunk, () => reducibleChunkCount );
    LOG && this.logger.logIndexed( encoder, completeChunksBuffer, 'completeChunks (no indices)', RasterCompleteChunk, () => completeChunkCount );
    LOG && this.logger.logIndexed( encoder, chunkIndexMapBuffer, 'chunkIndexMap', BufferLogger.RasterU32, () => numUsedClippedChunks );

    const reducibleEdgesBuffer = this.deviceContext.createBuffer( RasterEdge.ENCODING_BYTE_LENGTH * MAX_EDGE_CLIPS );
    const completeEdgesBuffer = this.deviceContext.createBuffer( RasterCompleteEdge.ENCODING_BYTE_LENGTH * MAX_COMPLETE_EDGES );
    const chunkIndicesBuffer = this.deviceContext.createBuffer( 4 * 2 * MAX_CLIPPED_CHUNKS );

    this.edgeScanShader.dispatchIndirect( encoder, [
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

    LOG && this.logger.logIndexed( encoder, reducibleEdgesBuffer, 'reducibleEdges (unmapped chunks)', RasterEdge, () => reducibleEdgeCount );
    LOG && this.logger.logIndexed( encoder, completeEdgesBuffer, 'completeEdges', RasterCompleteEdge, () => completeEdgeCount );
    LOG && this.logger.logIndexed( encoder, chunkIndicesBuffer, 'chunkIndices', BufferLogger.RasterU32, () => 2 * numUsedClippedChunks );

    this.chunkIndexPatchShader.dispatchIndirect( encoder, [
      configBuffer,
      chunkIndexMapBuffer,
      chunkIndicesBuffer,
      clippedChunksBuffer,
      reducibleChunksBuffer,
      completeChunksBuffer
    ], configBuffer, 48 );

    LOG && this.logger.logIndexed( encoder, reducibleChunksBuffer, 'reducibleChunks', RasterChunk, () => reducibleChunkCount );
    LOG && this.logger.logIndexed( encoder, completeChunksBuffer, 'completeChunks', RasterCompleteChunk, () => completeChunkCount );

    this.uniformUpdateShader.dispatch( encoder, [
      splitReduces2Buffer,
      edgeReduces2Buffer,
      configBuffer
    ], 1, 1, 1 );

    LOG && this.logger.logIndexed( encoder, configBuffer, 'config', BufferLogger.RasterU32, () => 38 );

    this.edgeIndexPatchShader.dispatchIndirect( encoder, [
      configBuffer,
      chunkIndexMapBuffer,
      chunkIndicesBuffer,
      reducibleEdgesBuffer
    ], configBuffer, 12 );

    LOG && this.logger.logIndexed( encoder, reducibleEdgesBuffer, 'reducibleEdges', RasterEdge, () => reducibleEdgeCount );
    // LOG && this.logger.logIndexed( encoder, completeEdgesBuffer, 'completeEdges', RasterCompleteEdge, () => completeEdgeCount );

    return {
      reducibleChunksBuffer: reducibleChunksBuffer,
      completeChunksBuffer: completeChunksBuffer,
      reducibleEdgesBuffer: reducibleEdgesBuffer,
      completeEdgesBuffer: completeEdgesBuffer,
      temporaryBuffers: [
        clippedChunksBuffer,
        edgeClipsBuffer,
        chunkReduces0Buffer,
        debugChunkReduces0Buffer,
        chunkReduces1Buffer,
        chunkReduces2Buffer,
        splitReduces0Buffer,
        debugInitialSplitReduceBuffer,
        edgeReduces0Buffer,
        debugInitialEdgeReduceBuffer,
        splitReduces1Buffer,
        splitReduces2Buffer,
        edgeReduces1Buffer,
        edgeReduces2Buffer,
        chunkIndexMapBuffer,
        debugSplitScanReducesBuffer,
        chunkIndicesBuffer
      ]
    };
  }
}

alpenglow.register( 'RasterClipper', RasterClipper );
