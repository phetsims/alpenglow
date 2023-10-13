// Copyright 2023, University of Colorado Boulder

/**
 * Rasterization prototype for WebGPU, but using the parallel (debuggable) API.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, Binding, BlitShader, BufferLogger, ByteEncoder, ComputeShader, DeviceContext, RasterChunk, RasterChunkReducePair, RasterChunkReduceQuad, RasterClippedChunk, RasterCompleteChunk, RasterCompleteEdge, RasterEdge, RasterEdgeClip, RasterSplitReduceData, RENDER_BLEND_CONSTANTS, RENDER_COMPOSE_CONSTANTS, RENDER_EXTEND_CONSTANTS, RENDER_GRADIENT_TYPE_CONSTANTS, RenderableFace, RenderColor, RenderColorSpace, RenderInstruction, RenderLinearBlend, RenderLinearBlendAccuracy, TestToCanvas, wgsl_raster_accumulate, wgsl_raster_chunk_index_patch, wgsl_raster_chunk_reduce, wgsl_raster_edge_index_patch, wgsl_raster_edge_scan, wgsl_raster_initial_chunk, wgsl_raster_initial_clip, wgsl_raster_initial_edge_reduce, wgsl_raster_initial_split_reduce, wgsl_raster_split_reduce, wgsl_raster_split_scan, wgsl_raster_to_texture, wgsl_raster_uniform_update } from '../imports.js';
import Vector2 from '../../../dot/js/Vector2.js';
import Vector4 from '../../../dot/js/Vector4.js';
import Matrix3 from '../../../dot/js/Matrix3.js';

const WORKGROUP_SIZE = 128;
const BOUNDS_REDUCE = false;
const LOG = false;
const DEBUG_REDUCE_BUFFERS = false;
const DEBUG_ACCUMULATION = false;
const ONLY_ONCE = true;
const NUM_STAGES = 16;


// TODO: figure out better output buffer size, since it's hard to bound
const MAX_EXPONENT = 20; // works for our small demo for now
const MAX_COMPLETE_CHUNKS = 2 ** MAX_EXPONENT;
const MAX_COMPLETE_EDGES = 2 ** MAX_EXPONENT;

const MAX_CHUNKS = 2 ** MAX_EXPONENT;
const MAX_EDGES = 2 ** MAX_EXPONENT;
const MAX_CLIPPED_CHUNKS = 2 * MAX_CHUNKS;
const MAX_EDGE_CLIPS = 2 * MAX_EDGES;

const CONFIG_NUM_WORDS = 45;
const CONFIG_COUNT_WORD_OFFSET = 33;

const rasterClipperMap = new WeakMap<DeviceContext, RasterClipper>();

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
  private readonly accumulateShader: ComputeShader;
  private readonly toTextureShader: ComputeShader;

  private readonly blitShader: BlitShader;

  public static get( deviceContext: DeviceContext ): RasterClipper {
    let rasterClipper = rasterClipperMap.get( deviceContext );
    if ( !rasterClipper ) {
      rasterClipper = new RasterClipper( deviceContext );
      rasterClipperMap.set( deviceContext, rasterClipper );
    }
    return rasterClipper;
  }

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
      boundsReduce: BOUNDS_REDUCE,
      debugReduceBuffers: DEBUG_REDUCE_BUFFERS,
      debugAccumulation: DEBUG_ACCUMULATION,
      integerScale: 5e6,
      preferredStorageFormat: deviceContext.preferredStorageFormat,

      // for RenderProgram handling
      stackSize: 10,
      instructionStackSize: 8,
      // eslint-disable-next-line no-object-spread-on-non-literals
      ...RenderInstruction.CODE_NAME_CONSTANTS,
      // eslint-disable-next-line no-object-spread-on-non-literals
      ...RENDER_BLEND_CONSTANTS,
      // eslint-disable-next-line no-object-spread-on-non-literals
      ...RENDER_COMPOSE_CONSTANTS,
      // eslint-disable-next-line no-object-spread-on-non-literals
      ...RENDER_EXTEND_CONSTANTS,
      // eslint-disable-next-line no-object-spread-on-non-literals
      ...RENDER_GRADIENT_TYPE_CONSTANTS
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

    this.accumulateShader = ComputeShader.fromSource( this.device, 'accumulate', wgsl_raster_accumulate, [
      Binding.UNIFORM_BUFFER,
      Binding.READ_ONLY_STORAGE_BUFFER,
      Binding.READ_ONLY_STORAGE_BUFFER,
      Binding.READ_ONLY_STORAGE_BUFFER,
      Binding.STORAGE_BUFFER,
      ...( DEBUG_ACCUMULATION ? [ Binding.STORAGE_BUFFER ] : [] )
    ], shaderOptions );

    this.toTextureShader = ComputeShader.fromSource( this.device, 'to_texture', wgsl_raster_to_texture, [
      Binding.UNIFORM_BUFFER,
      Binding.READ_ONLY_STORAGE_BUFFER,
      deviceContext.preferredStorageFormat === 'bgra8unorm' ? Binding.TEXTURE_OUTPUT_BGRA8UNORM : Binding.TEXTURE_OUTPUT_RGBA8UNORM
    ], shaderOptions );

    this.blitShader = new BlitShader( this.device, deviceContext.preferredCanvasFormat );
  }

  public static async test(): Promise<void> {
    const device = ( await DeviceContext.getDevice() )!;
    assert && assert( device );

    const deviceContext = new DeviceContext( device );

    const rasterClipper = new RasterClipper( deviceContext );

    const rasterSize = 256;

    const canvas = document.createElement( 'canvas' );
    canvas.width = rasterSize;
    canvas.height = rasterSize;
    // canvas.style.width = `${rasterSize / window.devicePixelRatio}px`; // TODO: hopefully integral for tests
    // canvas.style.height = `${rasterSize / window.devicePixelRatio}px`;

    canvas.style.imageRendering = 'pixelated';
    canvas.style.width = `${4 * rasterSize / window.devicePixelRatio}px`; // TODO: hopefully integral for tests
    canvas.style.height = `${4 * rasterSize / window.devicePixelRatio}px`;
    document.body.appendChild( canvas );

    const context = deviceContext.getCanvasContext( canvas, 'srgb' );

    const clippableFace = TestToCanvas.getTestPath().toEdgedFace().withReversedEdges();

    const matrix = Matrix3.scaling( 0.35 );
    const transformedFace = clippableFace.getTransformed( matrix );
    const renderableFace = new RenderableFace(
      transformedFace,
      new RenderLinearBlend(
        new Vector2( 1 / 256, 0 ),
        0,
        // RenderLinearBlendAccuracy.Accurate,
        RenderLinearBlendAccuracy.PixelCenter,
        new RenderColor( new Vector4( 1, 0, 0, 1 ) ).colorConverted( RenderColorSpace.sRGB, RenderColorSpace.premultipliedOklab ),
        new RenderColor( new Vector4( 0.5, 0, 1, 1 ) ).colorConverted( RenderColorSpace.sRGB, RenderColorSpace.premultipliedOklab )
      ).colorConverted( RenderColorSpace.premultipliedOklab, RenderColorSpace.premultipliedLinearSRGB ),
      transformedFace.getBounds()
    );

    const matrix2 = Matrix3.translation( 128, 0 ).timesMatrix( Matrix3.scaling( 0.05 ) );
    const transformedFace2 = clippableFace.getTransformed( matrix2 );
    const renderableFace2 = new RenderableFace(
      transformedFace2,
      new RenderColor(
        new Vector4( 0, 0, 0, 1 )
      ).colorConverted( RenderColorSpace.sRGB, RenderColorSpace.premultipliedLinearSRGB ),
      transformedFace2.getBounds()
    );

    let count = 0;
    await ( async function step() {
      if ( ONLY_ONCE && count++ > 0 ) {
        return;
      }

      // @ts-expect-error LEGACY --- it would know to update just the DOM element's location if it's the second argument
      window.requestAnimationFrame( step, canvas );

      await rasterClipper.rasterize( [ renderableFace, renderableFace2 ], context.getCurrentTexture() );
    } )();
  }

  public rasterize(
    renderableFaces: RenderableFace[],
    canvasTexture: GPUTexture
  ): Promise<void> {
    const width = canvasTexture.width;
    const height = canvasTexture.height;
    const device = this.device;
    const deviceContext = this.deviceContext;

    const inputChunksEncoder = new ByteEncoder();
    const instructionsEncoder = new ByteEncoder();
    const inputEdgesEncoder = new ByteEncoder();

    let numInputChunks = 0;
    let numInputEdges = 0;

    renderableFaces.forEach( renderableFace => {
      const renderProgram = renderableFace.renderProgram;
      const edgesOffset = numInputEdges;
      const chunkIndex = numInputChunks;

      // TODO: RENDER WITH OFFSETS!
      const edgeClippedFace = renderableFace.face.toEdgedClippedFaceWithoutCheck( 0, 0, width, height );
      const edges = edgeClippedFace.edges;

      new RasterChunk(
        instructionsEncoder.byteLength / 4,
        renderProgram.needsFace || renderProgram.needsCentroid,
        renderProgram instanceof RenderColor,
        edgesOffset,
        edges.length,
        edgeClippedFace.minX,
        edgeClippedFace.minY,
        edgeClippedFace.maxX,
        edgeClippedFace.maxY,
        edgeClippedFace.minXCount,
        edgeClippedFace.minYCount,
        edgeClippedFace.maxXCount,
        edgeClippedFace.maxYCount
      ).writeEncoding( inputChunksEncoder );
      numInputChunks++;

      edges.forEach( ( edge, i ) => {
        new RasterEdge(
          chunkIndex,
          i === 0,
          i === edges.length - 1,
          edge.startPoint,
          edge.endPoint
        ).writeEncoding( inputEdgesEncoder );
        numInputEdges++;
      } );

      // TODO: use hashes in the future to deduplicate RenderProgram instances!
      const instructions: RenderInstruction[] = [];
      renderProgram.writeInstructions( instructions );
      RenderInstruction.instructionsToBinary( instructionsEncoder, instructions );
    } );

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

      // accumulate workgroup
      0, 0, 0, // will be filled in later

      numInputChunks,
      numInputEdges,

      numClippedChunks,
      numEdgeClips,

      // filled in later
      0, 0, 0, 0,

      // raster width/height
      width, height,

      // raster offset x/y
      0, 0
    ];

    const configBuffer = device.createBuffer( {
      label: 'config buffer',
      size: 4 * configData.length,
      // NOTE: COPY_SRC here for debugging
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE | GPUBufferUsage.INDIRECT | GPUBufferUsage.COPY_SRC
    } );
    device.queue.writeBuffer( configBuffer, 0, new Uint32Array( configData ).buffer );

    const instructionsBuffer = deviceContext.createBuffer( instructionsEncoder.byteLength );
    device.queue.writeBuffer( instructionsBuffer, 0, instructionsEncoder.arrayBuffer );

    const inputChunksBuffer = deviceContext.createBuffer( RasterChunk.ENCODING_BYTE_LENGTH * numInputChunks );
    assert && assert( inputChunksEncoder.byteLength === RasterChunk.ENCODING_BYTE_LENGTH * numInputChunks );
    device.queue.writeBuffer( inputChunksBuffer, 0, inputChunksEncoder.arrayBuffer );
    // TODO: in the future, can we allocate things so that we just provide the fullArrayBuffer directly?

    const inputEdgesBuffer = deviceContext.createBuffer( RasterEdge.ENCODING_BYTE_LENGTH * numInputEdges );
    assert && assert( inputEdgesEncoder.byteLength === RasterEdge.ENCODING_BYTE_LENGTH * numInputEdges );
    device.queue.writeBuffer( inputEdgesBuffer, 0, inputEdgesEncoder.arrayBuffer );

    const accumulationBuffer = deviceContext.createBuffer( 4 * 4 * width * height );

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
      fineOutputTexture = device.createTexture( {
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

    const encoder = device.createCommandEncoder( {
      label: 'the encoder'
    } );

    const numStages = NUM_STAGES;
    const stageOutput = this.runAccumulate(
      encoder, configBuffer, instructionsBuffer, inputChunksBuffer, inputEdgesBuffer, accumulationBuffer, numStages
    );

    // Have the fine-rasterization shader use the preferred format as output (for now)
    this.toTextureShader.dispatch( encoder, [
      configBuffer, accumulationBuffer, fineOutputTextureView
    ], width / 16, height / 16 );

    if ( !canOutputToCanvas ) {
      assert && assert( fineOutputTexture, 'If we cannot output to the Canvas directly, we will have created a texture' );

      this.blitShader.dispatch( encoder, canvasTextureView, fineOutputTextureView );
    }

    const commandBuffer = encoder.finish();
    device.queue.submit( [ commandBuffer ] );

    const donePromise = device.queue.onSubmittedWorkDone().then( async () => {
      // TODO: oh no, do we need to pool or create loggers?
      await this.logger.complete();
    } ).catch( err => {
      throw err;
    } );

    configBuffer.destroy();
    inputChunksBuffer.destroy();
    inputEdgesBuffer.destroy();
    accumulationBuffer.destroy();
    fineOutputTexture && fineOutputTexture.destroy();
    stageOutput.temporaryBuffers.forEach( buffer => buffer.destroy() );

    return donePromise;
  }

  public runAccumulate(
    encoder: GPUCommandEncoder,
    configBuffer: GPUBuffer,
    instructionsBuffer: GPUBuffer,
    inputChunksBuffer: GPUBuffer,
    inputEdgesBuffer: GPUBuffer,
    accumulationBuffer: GPUBuffer,
    numStages: number
  ): {
    temporaryBuffers: GPUBuffer[];
  } {

    const temporaryBuffers: GPUBuffer[] = [];

    for ( let i = 0; i < numStages; i++ ) {
      const stageResult = this.runStage( encoder, configBuffer, instructionsBuffer, inputChunksBuffer, inputEdgesBuffer, accumulationBuffer );
      inputChunksBuffer = stageResult.reducibleChunksBuffer;
      inputEdgesBuffer = stageResult.reducibleEdgesBuffer;
      temporaryBuffers.push( inputChunksBuffer, inputEdgesBuffer, ...stageResult.temporaryBuffers );
    }

    return {
      temporaryBuffers: temporaryBuffers
    };
  }

  // TODO: actually, can we just reuse the other buffers so we're not executing things all over the place?
  public runStage(
    encoder: GPUCommandEncoder,
    configBuffer: GPUBuffer,
    instructionsBuffer: GPUBuffer,
    inputChunksBuffer: GPUBuffer,
    inputEdgesBuffer: GPUBuffer,
    accumulationBuffer: GPUBuffer
  ): {
    reducibleChunksBuffer: GPUBuffer;
    reducibleEdgesBuffer: GPUBuffer;
    temporaryBuffers: GPUBuffer[];
  } {
    const workgroupSize = WORKGROUP_SIZE;

    let numUsedInputChunks = -1;
    let numUsedInputEdges = -1;
    let numUsedClippedChunks = -1;
    let numUsedEdgeClips = -1;

    LOG && this.logger.withBuffer( encoder, configBuffer, async arrayBuffer => {
      numUsedInputChunks = new Uint32Array( arrayBuffer )[ CONFIG_COUNT_WORD_OFFSET ];
      numUsedInputEdges = new Uint32Array( arrayBuffer )[ CONFIG_COUNT_WORD_OFFSET + 1 ];
      numUsedClippedChunks = new Uint32Array( arrayBuffer )[ CONFIG_COUNT_WORD_OFFSET + 2 ];
      numUsedEdgeClips = new Uint32Array( arrayBuffer )[ CONFIG_COUNT_WORD_OFFSET + 3 ];
      console.log( 'chunks', numUsedInputChunks, 'edges', numUsedInputEdges );
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

    LOG && this.logger.logIndexed( encoder, configBuffer, 'config', BufferLogger.RasterU32, () => CONFIG_NUM_WORDS );

    this.edgeIndexPatchShader.dispatchIndirect( encoder, [
      configBuffer,
      chunkIndexMapBuffer,
      chunkIndicesBuffer,
      reducibleEdgesBuffer
    ], configBuffer, 12 );

    LOG && this.logger.logIndexed( encoder, reducibleEdgesBuffer, 'reducibleEdges', RasterEdge, () => reducibleEdgeCount );
    // LOG && this.logger.logIndexed( encoder, completeEdgesBuffer, 'completeEdges', RasterCompleteEdge, () => completeEdgeCount );

    const debugAccumulationBuffer = this.deviceContext.createBuffer( 4 * MAX_COMPLETE_CHUNKS );

    this.accumulateShader.dispatchIndirect( encoder, [
      configBuffer,
      instructionsBuffer,
      completeChunksBuffer,
      completeEdgesBuffer,
      accumulationBuffer,
      ...( DEBUG_ACCUMULATION ? [ debugAccumulationBuffer ] : [] )
    ], configBuffer, 120 );

    // LOG && this.logger.logIndexed( encoder, accumulationBuffer, 'accumulation', BufferLogger.RasterF32, () => 4 * rasterSize * rasterSize );
    if ( DEBUG_ACCUMULATION ) {
      LOG && this.logger.logIndexed( encoder, debugAccumulationBuffer, 'debugAccumulation', BufferLogger.RasterI32, () => completeChunkCount );
    }

    return {
      reducibleChunksBuffer: reducibleChunksBuffer,
      reducibleEdgesBuffer: reducibleEdgesBuffer,
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
        chunkIndicesBuffer,
        completeChunksBuffer,
        completeEdgesBuffer
      ]
    };
  }
}

alpenglow.register( 'RasterClipper', RasterClipper );
