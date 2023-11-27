// Copyright 2023, University of Colorado Boulder

/**
 * Rasterization prototype for WebGPU, but using the parallel (debuggable) API.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BindingType, BlitShader, BufferLogger, ByteEncoder, ComputeShader, DeviceContext, PolygonalBoolean, PolygonalFace, RasterChunk, RasterChunkReducePair, RasterChunkReduceQuad, RasterClippedChunk, RasterCompleteChunk, RasterCompleteEdge, RasterEdge, RasterEdgeClip, Rasterize, RasterSplitReduceData, RENDER_BLEND_CONSTANTS, RENDER_COMPOSE_CONSTANTS, RENDER_EXTEND_CONSTANTS, RENDER_GRADIENT_TYPE_CONSTANTS, RenderableFace, RenderColor, RenderColorSpace, RenderInstruction, RenderLinearBlend, RenderLinearBlendAccuracy, RenderPath, RenderPathBoolean, RenderStack, TestToCanvas, wgsl_raster_accumulate, wgsl_raster_chunk_index_patch, wgsl_raster_chunk_reduce, wgsl_raster_edge_index_patch, wgsl_raster_edge_scan, wgsl_raster_initial_chunk, wgsl_raster_initial_clip, wgsl_raster_initial_edge_reduce, wgsl_raster_initial_split_reduce, wgsl_raster_split_reduce, wgsl_raster_split_scan, wgsl_raster_to_texture, wgsl_raster_uniform_update } from '../imports.js';
import Vector2 from '../../../dot/js/Vector2.js';
import Vector4 from '../../../dot/js/Vector4.js';
import Matrix3 from '../../../dot/js/Matrix3.js';
import Bounds2 from '../../../dot/js/Bounds2.js';
import { optionize3 } from '../../../phet-core/js/optionize.js';

const WORKGROUP_SIZE = 128;
const BOUNDS_REDUCE = false;
const LOG = false;
const DEBUG_REDUCE_BUFFERS = false;
const DEBUG_ACCUMULATION = false;
const REUSE_BUFFERS = true;
const ONLY_ONCE = true;

const CONFIG_NUM_WORDS = 46;
const CONFIG_COUNT_WORD_OFFSET = 33;

const rasterClipperMap = new WeakMap<DeviceContext, RasterClipper>();

export type RasterClipperOptions = {
  colorSpace?: 'srgb' | 'display-p3';
  numStages?: number;
  bufferExponent?: number; // TODO doc
};

const DEFAULT_OPTIONS = {
  colorSpace: 'srgb',
  numStages: 16,
  bufferExponent: 20 // TODO: better default value
} as const;

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
      BindingType.UNIFORM_BUFFER,
      BindingType.READ_ONLY_STORAGE_BUFFER,
      BindingType.STORAGE_BUFFER
    ], shaderOptions );

    this.initialClipShader = ComputeShader.fromSource( this.device, 'initial_clip', wgsl_raster_initial_clip, [
      BindingType.UNIFORM_BUFFER,
      BindingType.READ_ONLY_STORAGE_BUFFER,
      BindingType.READ_ONLY_STORAGE_BUFFER,
      BindingType.STORAGE_BUFFER,
      BindingType.STORAGE_BUFFER,
      BindingType.STORAGE_BUFFER,
      ...( DEBUG_REDUCE_BUFFERS ? [ BindingType.STORAGE_BUFFER ] : [] )
    ], shaderOptions );

    this.chunkReduceShader = ComputeShader.fromSource( this.device, 'chunk_reduce', wgsl_raster_chunk_reduce, [
      BindingType.UNIFORM_BUFFER,
      BindingType.UNIFORM_BUFFER,
      BindingType.READ_ONLY_STORAGE_BUFFER,
      BindingType.STORAGE_BUFFER,
      BindingType.STORAGE_BUFFER
    ], shaderOptions );

    this.initialSplitReduceShader = ComputeShader.fromSource( this.device, 'initial_split_reduce', wgsl_raster_initial_split_reduce, [
      BindingType.UNIFORM_BUFFER,
      BindingType.READ_ONLY_STORAGE_BUFFER,
      BindingType.STORAGE_BUFFER,
      ...( DEBUG_REDUCE_BUFFERS ? [ BindingType.STORAGE_BUFFER ] : [] )
    ], shaderOptions );

    this.initialEdgeReduceShader = ComputeShader.fromSource( this.device, 'initial_edge_reduce', wgsl_raster_initial_edge_reduce, [
      BindingType.UNIFORM_BUFFER,
      BindingType.READ_ONLY_STORAGE_BUFFER,
      BindingType.READ_ONLY_STORAGE_BUFFER,
      BindingType.STORAGE_BUFFER,
      ...( DEBUG_REDUCE_BUFFERS ? [ BindingType.STORAGE_BUFFER ] : [] )
    ], shaderOptions );

    this.splitReduceShader = ComputeShader.fromSource( this.device, 'split_reduce', wgsl_raster_split_reduce, [
      BindingType.UNIFORM_BUFFER,
      BindingType.UNIFORM_BUFFER,
      BindingType.STORAGE_BUFFER,
      BindingType.STORAGE_BUFFER
    ], shaderOptions );

    this.splitScanShader = ComputeShader.fromSource( this.device, 'split_scan', wgsl_raster_split_scan, [
      BindingType.UNIFORM_BUFFER,
      BindingType.READ_ONLY_STORAGE_BUFFER,
      BindingType.READ_ONLY_STORAGE_BUFFER,
      BindingType.READ_ONLY_STORAGE_BUFFER,
      BindingType.READ_ONLY_STORAGE_BUFFER,
      BindingType.STORAGE_BUFFER,
      BindingType.STORAGE_BUFFER,
      BindingType.STORAGE_BUFFER,
      ...( DEBUG_REDUCE_BUFFERS ? [ BindingType.STORAGE_BUFFER ] : [] )
    ], shaderOptions );

    this.edgeScanShader = ComputeShader.fromSource( this.device, 'edge_scan', wgsl_raster_edge_scan, [
      BindingType.UNIFORM_BUFFER,
      BindingType.READ_ONLY_STORAGE_BUFFER,
      BindingType.READ_ONLY_STORAGE_BUFFER,
      BindingType.READ_ONLY_STORAGE_BUFFER,
      BindingType.READ_ONLY_STORAGE_BUFFER,
      BindingType.READ_ONLY_STORAGE_BUFFER,
      BindingType.STORAGE_BUFFER,
      BindingType.STORAGE_BUFFER,
      BindingType.STORAGE_BUFFER
    ], shaderOptions );

    this.chunkIndexPatchShader = ComputeShader.fromSource( this.device, 'chunk_index_patch', wgsl_raster_chunk_index_patch, [
      BindingType.UNIFORM_BUFFER,
      BindingType.READ_ONLY_STORAGE_BUFFER,
      BindingType.READ_ONLY_STORAGE_BUFFER,
      BindingType.READ_ONLY_STORAGE_BUFFER,
      BindingType.STORAGE_BUFFER,
      BindingType.STORAGE_BUFFER
    ], shaderOptions );

    this.uniformUpdateShader = ComputeShader.fromSource( this.device, 'uniform_update', wgsl_raster_uniform_update, [
      BindingType.READ_ONLY_STORAGE_BUFFER,
      BindingType.READ_ONLY_STORAGE_BUFFER,
      BindingType.STORAGE_BUFFER
    ], shaderOptions );

    this.edgeIndexPatchShader = ComputeShader.fromSource( this.device, 'edge_index_patch', wgsl_raster_edge_index_patch, [
      BindingType.UNIFORM_BUFFER,
      BindingType.READ_ONLY_STORAGE_BUFFER,
      BindingType.READ_ONLY_STORAGE_BUFFER,
      BindingType.STORAGE_BUFFER
    ], shaderOptions );

    this.accumulateShader = ComputeShader.fromSource( this.device, 'accumulate', wgsl_raster_accumulate, [
      BindingType.UNIFORM_BUFFER,
      BindingType.READ_ONLY_STORAGE_BUFFER,
      BindingType.READ_ONLY_STORAGE_BUFFER,
      BindingType.READ_ONLY_STORAGE_BUFFER,
      BindingType.STORAGE_BUFFER,
      ...( DEBUG_ACCUMULATION ? [ BindingType.STORAGE_BUFFER ] : [] )
    ], shaderOptions );

    this.toTextureShader = ComputeShader.fromSource( this.device, 'to_texture', wgsl_raster_to_texture, [
      BindingType.UNIFORM_BUFFER,
      BindingType.READ_ONLY_STORAGE_BUFFER,
      deviceContext.preferredStorageFormat === 'bgra8unorm' ? BindingType.TEXTURE_OUTPUT_BGRA8UNORM : BindingType.TEXTURE_OUTPUT_RGBA8UNORM
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
    canvas.style.width = `${rasterSize / window.devicePixelRatio}px`; // TODO: hopefully integral for tests
    canvas.style.height = `${rasterSize / window.devicePixelRatio}px`;

    // canvas.style.imageRendering = 'pixelated';
    // canvas.style.width = `${4 * rasterSize / window.devicePixelRatio}px`; // TODO: hopefully integral for tests
    // canvas.style.height = `${4 * rasterSize / window.devicePixelRatio}px`;
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

    const matrix2 = Matrix3.translation( 16, 165 ).timesMatrix( Matrix3.scaling( 0.15 ) );
    const transformedFace2 = clippableFace.getTransformed( matrix2 );
    const renderableFace2 = new RenderableFace(
      transformedFace2,
      new RenderColor(
        new Vector4( 1, 1, 1, 1 )
      ).colorConverted( RenderColorSpace.sRGB, RenderColorSpace.premultipliedLinearSRGB ),
      transformedFace2.getBounds()
    );

    const backgroundOriginal = PolygonalFace.fromBoundsValues( 0, 0, 128, 256 );
    const difference1 = PolygonalBoolean.difference(
      new RenderPath( 'nonzero', backgroundOriginal.polygons ),
      new RenderPath( 'nonzero', transformedFace.toPolygonalFace().polygons )
    );
    const difference = PolygonalBoolean.difference(
      new RenderPath( 'nonzero', difference1 ),
      new RenderPath( 'nonzero', transformedFace2.toPolygonalFace().polygons )
    );
    const backgroundClippableFace = new PolygonalFace( difference );
    const background = new RenderableFace(
      backgroundClippableFace,
      new RenderColor(
        new Vector4( 0, 0, 0, 1 )
      ).colorConverted( RenderColorSpace.sRGB, RenderColorSpace.premultipliedLinearSRGB ),
      backgroundClippableFace.getBounds()
    );

    const backgroundOriginal2 = PolygonalFace.fromBoundsValues( 128, 0, 256, 256 );
    const difference2 = PolygonalBoolean.difference(
      new RenderPath( 'nonzero', backgroundOriginal2.polygons ),
      new RenderPath( 'nonzero', transformedFace.toPolygonalFace().polygons )
    );
    const backgroundClippableFace2 = new PolygonalFace( difference2 );
    const background2 = new RenderableFace(
      backgroundClippableFace2,
      new RenderColor(
        new Vector4( 1, 1, 1, 1 )
      ).colorConverted( RenderColorSpace.sRGB, RenderColorSpace.premultipliedLinearSRGB ),
      backgroundClippableFace2.getBounds()
    );

    let count = 0;
    await ( async function step() {
      if ( ONLY_ONCE && count++ > 0 ) {
        return;
      }

      // @ts-expect-error LEGACY --- it would know to update just the DOM element's location if it's the second argument
      window.requestAnimationFrame( step, canvas );

      await rasterClipper.rasterize( [ renderableFace, renderableFace2, background, background2 ], context.getCurrentTexture(), {
        colorSpace: 'srgb'
      } );
    } )();
  }

  public static async testWithRasterizer(): Promise<void> {
    const device = ( await DeviceContext.getDevice() )!;
    assert && assert( device );

    const deviceContext = new DeviceContext( device );

    const rasterSize = 512;

    const canvas = document.createElement( 'canvas' );
    canvas.width = rasterSize;
    canvas.height = rasterSize;
    canvas.style.width = `${rasterSize / window.devicePixelRatio}px`; // TODO: hopefully integral for tests
    canvas.style.height = `${rasterSize / window.devicePixelRatio}px`;

    // canvas.style.imageRendering = 'pixelated';
    // canvas.style.width = `${4 * rasterSize / window.devicePixelRatio}px`; // TODO: hopefully integral for tests
    // canvas.style.height = `${4 * rasterSize / window.devicePixelRatio}px`;
    document.body.appendChild( canvas );

    const context = deviceContext.getCanvasContext( canvas, 'srgb' );

    const clippableFace = TestToCanvas.getTestPath();

    const mainFace = clippableFace.getTransformed( Matrix3.scaling( 0.37 ) );
    const smallerFace = clippableFace.getTransformed( Matrix3.translation( 16, 165 ).timesMatrix( Matrix3.scaling( 0.15 ) ) );

    const clientSpace = RenderColorSpace.premultipliedLinearSRGB;

    const program = new RenderStack( [
      new RenderPathBoolean(
        RenderPath.fromBounds( new Bounds2( 0, 0, 128, 256 ) ),
        new RenderColor(
          new Vector4( 0, 0, 0, 1 )
        ).colorConverted( RenderColorSpace.sRGB, clientSpace ),
        new RenderColor(
          new Vector4( 1, 1, 1, 1 )
        ).colorConverted( RenderColorSpace.sRGB, clientSpace )
      ),
      RenderPathBoolean.fromInside(
        new RenderPath( 'nonzero', smallerFace.toPolygonalFace().polygons ),
        new RenderColor(
          new Vector4( 1, 1, 1, 1 )
        ).colorConverted( RenderColorSpace.sRGB, clientSpace )
      ),
      RenderPathBoolean.fromInside(
        new RenderPath( 'nonzero', mainFace.toPolygonalFace().polygons ),
        new RenderLinearBlend(
          new Vector2( 1 / 256, 0 ),
          0,
          RenderLinearBlendAccuracy.Accurate,
          // RenderLinearBlendAccuracy.PixelCenter,
          new RenderColor( new Vector4( 1, 0, 0, 1 ) ).colorConverted( RenderColorSpace.sRGB, RenderColorSpace.premultipliedOklab ),
          new RenderColor( new Vector4( 0.5, 0, 1, 1 ) ).colorConverted( RenderColorSpace.sRGB, RenderColorSpace.premultipliedOklab )
        ).colorConverted( RenderColorSpace.premultipliedOklab, clientSpace )
      )
    ] ).transformed( Matrix3.scaling( rasterSize / 256 ) );

    let count = 0;
    await ( async function step() {
      if ( ONLY_ONCE && count++ > 0 ) {
        return;
      }

      // @ts-expect-error LEGACY --- it would know to update just the DOM element's location if it's the second argument
      window.requestAnimationFrame( step, canvas );

      await Rasterize.hybridRasterize( program, deviceContext, context, new Bounds2( 0, 0, rasterSize, rasterSize ), 'srgb', {
        rasterClipperOptions: {
          numStages: 16,
          bufferExponent: 14
        }
      } );
    } )();
  }

  public rasterize(
    renderableFaces: RenderableFace[],
    canvasTexture: GPUTexture,
    providedOptions: RasterClipperOptions
  ): Promise<void> {
    const options = optionize3<RasterClipperOptions>()( {}, DEFAULT_OPTIONS, providedOptions );

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

      // TODO: RENDER WITH OFFSETS! AND POLYGONAL FILTERING
      const bounds = renderableFace.bounds.roundedOut();
      const edgeClippedFace = renderableFace.face.toEdgedClippedFaceWithoutCheck(
        bounds.minX, bounds.minY, bounds.maxX, bounds.maxY
      );
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
      0, 0,

      // raster color space
      {
        srgb: 0,
        'display-p3': 1
      }[ options.colorSpace ]
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

    const destroyBuffers = this.runAccumulate(
      encoder, configBuffer, instructionsBuffer, inputChunksBuffer, inputEdgesBuffer, accumulationBuffer, options
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
    destroyBuffers();

    return donePromise;
  }

  // Returns callback to destroy buffers
  public runAccumulate(
    encoder: GPUCommandEncoder,
    configBuffer: GPUBuffer,
    instructionsBuffer: GPUBuffer,
    inputChunksBuffer: GPUBuffer,
    inputEdgesBuffer: GPUBuffer,
    accumulationBuffer: GPUBuffer,
    options: Required<RasterClipperOptions>
  ): () => void {
    if ( REUSE_BUFFERS ) {
      const stageBuffers = new StageBuffers( this.deviceContext, options.bufferExponent );

      for ( let i = 0; i < options.numStages; i++ ) {
        this.runStage( encoder, configBuffer, instructionsBuffer, inputChunksBuffer, inputEdgesBuffer, accumulationBuffer, stageBuffers );
        inputChunksBuffer = stageBuffers.reducibleChunksBuffer;
        inputEdgesBuffer = stageBuffers.reducibleEdgesBuffer;
      }

      return () => stageBuffers.destroy();
    }
    else {
      const stageBuffersList: StageBuffers[] = [];

      for ( let i = 0; i < options.numStages; i++ ) {
        const stageBuffers = new StageBuffers( this.deviceContext, options.bufferExponent );
        stageBuffersList.push( stageBuffers );
        this.runStage( encoder, configBuffer, instructionsBuffer, inputChunksBuffer, inputEdgesBuffer, accumulationBuffer, stageBuffers );
        inputChunksBuffer = stageBuffers.reducibleChunksBuffer;
        inputEdgesBuffer = stageBuffers.reducibleEdgesBuffer;
      }

      return () => stageBuffersList.forEach( stageBuffers => stageBuffers.destroy() );
    }
  }

  // TODO: actually, can we just reuse the other buffers so we're not executing things all over the place?
  public runStage(
    encoder: GPUCommandEncoder,
    configBuffer: GPUBuffer,
    instructionsBuffer: GPUBuffer,
    inputChunksBuffer: GPUBuffer,
    inputEdgesBuffer: GPUBuffer,
    accumulationBuffer: GPUBuffer,
    stageBuffers: StageBuffers
  ): void {
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

    this.initialChunksShader.dispatchIndirect( encoder, [
      configBuffer,
      inputChunksBuffer,
      stageBuffers.clippedChunksBuffer
    ], configBuffer, 0 );

    LOG && this.logger.logIndexed( encoder, stageBuffers.clippedChunksBuffer, 'clippedChunks (initial)', RasterClippedChunk, () => numUsedClippedChunks );

    this.initialClipShader.dispatchIndirect( encoder, [
      configBuffer,
      inputChunksBuffer,
      inputEdgesBuffer,
      stageBuffers.clippedChunksBuffer,
      stageBuffers.edgeClipsBuffer,
      stageBuffers.chunkReduces0Buffer,
      ...( stageBuffers.debugChunkReduces0Buffer ? [ stageBuffers.debugChunkReduces0Buffer ] : [] )
    ], configBuffer, 12 );

    LOG && this.logger.logIndexed( encoder, stageBuffers.edgeClipsBuffer, 'edgeClips', RasterEdgeClip, () => numUsedEdgeClips );
    LOG && this.logger.logIndexedMultiline( encoder, stageBuffers.chunkReduces0Buffer, 'chunkReduces0', RasterChunkReduceQuad, () => Math.ceil( numUsedInputEdges / workgroupSize ) );
    if ( stageBuffers.debugChunkReduces0Buffer ) {
      LOG && this.logger.logIndexedMultiline( encoder, stageBuffers.debugChunkReduces0Buffer, 'debugFullChunkReduces', RasterChunkReducePair, () => numUsedInputEdges );
    }

    this.chunkReduceShader.dispatchIndirect( encoder, [
      configBuffer,
      this.zeroBuffer, // signify our "first" chunkReduce
      stageBuffers.chunkReduces0Buffer,
      stageBuffers.clippedChunksBuffer,
      stageBuffers.chunkReduces1Buffer
    ], configBuffer, 24 );

    LOG && this.logger.logIndexedMultiline( encoder, stageBuffers.chunkReduces1Buffer, 'chunkReduces1', RasterChunkReduceQuad, () => Math.ceil( numUsedInputEdges / ( workgroupSize * workgroupSize ) ) );

    this.chunkReduceShader.dispatchIndirect( encoder, [
      configBuffer,
      this.oneBuffer, // signify our "second" chunkReduce
      stageBuffers.chunkReduces1Buffer,
      stageBuffers.clippedChunksBuffer,
      stageBuffers.chunkReduces2Buffer
    ], configBuffer, 36 );

    LOG && this.logger.logIndexedMultiline( encoder, stageBuffers.chunkReduces2Buffer, 'chunkReduces2', RasterChunkReduceQuad, () => Math.ceil( numUsedInputEdges / ( workgroupSize * workgroupSize * workgroupSize ) ) );
    LOG && this.logger.logIndexed( encoder, stageBuffers.clippedChunksBuffer, 'clippedChunks (reduced)', RasterClippedChunk, () => numUsedClippedChunks );

    this.initialSplitReduceShader.dispatchIndirect( encoder, [
      configBuffer,
      stageBuffers.clippedChunksBuffer,
      stageBuffers.splitReduces0Buffer,
      ...( stageBuffers.debugInitialSplitReduceBuffer ? [ stageBuffers.debugInitialSplitReduceBuffer ] : [] )
    ], configBuffer, 48 );

    this.initialEdgeReduceShader.dispatchIndirect( encoder, [
      configBuffer,
      stageBuffers.clippedChunksBuffer,
      stageBuffers.edgeClipsBuffer,
      stageBuffers.edgeReduces0Buffer,
      ...( stageBuffers.debugInitialEdgeReduceBuffer ? [ stageBuffers.debugInitialEdgeReduceBuffer ] : [] )
    ], configBuffer, 60 );

    if ( stageBuffers.debugInitialSplitReduceBuffer ) {
      LOG && this.logger.logIndexed( encoder, stageBuffers.debugInitialSplitReduceBuffer, 'debugInitialSplitReduce', RasterSplitReduceData, () => numUsedClippedChunks );
    }
    LOG && this.logger.logIndexed( encoder, stageBuffers.splitReduces0Buffer, 'splitReduces0', RasterSplitReduceData, () => Math.ceil( numUsedClippedChunks / workgroupSize ) );

    this.splitReduceShader.dispatchIndirect( encoder, [
      configBuffer,
      this.zeroBuffer, // signify our split0 splitReduce
      stageBuffers.splitReduces0Buffer,
      stageBuffers.splitReduces1Buffer
    ], configBuffer, 72 );

    LOG && this.logger.logIndexed( encoder, stageBuffers.splitReduces0Buffer, 'splitReduces0 (scanned)', RasterSplitReduceData, () => Math.ceil( numUsedClippedChunks / workgroupSize ) );
    LOG && this.logger.logIndexed( encoder, stageBuffers.splitReduces1Buffer, 'splitReduces1', RasterSplitReduceData, () => Math.ceil( numUsedClippedChunks / ( workgroupSize * workgroupSize ) ) );

    this.splitReduceShader.dispatchIndirect( encoder, [
      configBuffer,
      this.oneBuffer, // signify our split1 splitReduce
      stageBuffers.splitReduces1Buffer,
      stageBuffers.splitReduces2Buffer
    ], configBuffer, 84 );

    LOG && this.logger.logIndexed( encoder, stageBuffers.splitReduces1Buffer, 'splitReduces1 (scanned)', RasterSplitReduceData, () => Math.ceil( numUsedClippedChunks / ( workgroupSize * workgroupSize ) ) );
    LOG && this.logger.logIndexed( encoder, stageBuffers.splitReduces2Buffer, 'splitReduces2', RasterSplitReduceData, () => Math.ceil( numUsedClippedChunks / ( workgroupSize * workgroupSize * workgroupSize ) ) );

    let reducibleChunkCount = -1;
    let completeChunkCount = -1;

    LOG && this.logger.withBuffer( encoder, stageBuffers.splitReduces2Buffer, async arrayBuffer => {
      reducibleChunkCount = new Uint32Array( arrayBuffer )[ 0 ];
      completeChunkCount = new Uint32Array( arrayBuffer )[ 1 ];
    } );

    if ( stageBuffers.debugInitialEdgeReduceBuffer ) {
      LOG && this.logger.logIndexed( encoder, stageBuffers.debugInitialEdgeReduceBuffer, 'debugInitialEdgeReduce', RasterSplitReduceData, () => numUsedEdgeClips );
    }
    LOG && this.logger.logIndexed( encoder, stageBuffers.edgeReduces0Buffer, 'edgeReduces0', RasterSplitReduceData, () => Math.ceil( numUsedEdgeClips / workgroupSize ) );

    this.splitReduceShader.dispatchIndirect( encoder, [
      configBuffer,
      this.twoBuffer, // signify our edge0 splitReduce
      stageBuffers.edgeReduces0Buffer,
      stageBuffers.edgeReduces1Buffer
    ], configBuffer, 96 );

    LOG && this.logger.logIndexed( encoder, stageBuffers.edgeReduces0Buffer, 'edgeReduces0 (scanned)', RasterSplitReduceData, () => Math.ceil( numUsedEdgeClips / workgroupSize ) );
    LOG && this.logger.logIndexed( encoder, stageBuffers.edgeReduces1Buffer, 'edgeReduces1', RasterSplitReduceData, () => Math.ceil( numUsedEdgeClips / ( workgroupSize * workgroupSize ) ) );

    this.splitReduceShader.dispatchIndirect( encoder, [
      configBuffer,
      this.threeBuffer, // signify our edge1 splitReduce
      stageBuffers.edgeReduces1Buffer,
      stageBuffers.edgeReduces2Buffer
    ], configBuffer, 108 );

    LOG && this.logger.logIndexed( encoder, stageBuffers.edgeReduces1Buffer, 'edgeReduces1 (scanned)', RasterSplitReduceData, () => Math.ceil( numUsedEdgeClips / ( workgroupSize * workgroupSize ) ) );
    LOG && this.logger.logIndexed( encoder, stageBuffers.edgeReduces2Buffer, 'edgeReduces2', RasterSplitReduceData, () => Math.ceil( numUsedEdgeClips / ( workgroupSize * workgroupSize * workgroupSize ) ) );

    let reducibleEdgeCount = -1;
    let completeEdgeCount = -1;

    LOG && this.logger.withBuffer( encoder, stageBuffers.edgeReduces2Buffer, async arrayBuffer => {
      reducibleEdgeCount = new Uint32Array( arrayBuffer )[ 0 ];
      completeEdgeCount = new Uint32Array( arrayBuffer )[ 1 ];
    } );

    this.splitScanShader.dispatchIndirect( encoder, [
      configBuffer,
      stageBuffers.clippedChunksBuffer,
      stageBuffers.splitReduces0Buffer,
      stageBuffers.splitReduces1Buffer,
      stageBuffers.splitReduces2Buffer,
      stageBuffers.reducibleChunksBuffer,
      stageBuffers.completeChunksBuffer,
      stageBuffers.chunkIndexMapBuffer,
      ...( stageBuffers.debugSplitScanReducesBuffer ? [ stageBuffers.debugSplitScanReducesBuffer ] : [] )
    ], configBuffer, 48 );

    if ( stageBuffers.debugSplitScanReducesBuffer ) {
      LOG && this.logger.logIndexed( encoder, stageBuffers.debugSplitScanReducesBuffer, 'debugSplitScanReduces', RasterSplitReduceData, () => numUsedClippedChunks );
    }
    LOG && this.logger.logIndexed( encoder, stageBuffers.reducibleChunksBuffer, 'reducibleChunks (no indices)', RasterChunk, () => reducibleChunkCount );
    LOG && this.logger.logIndexed( encoder, stageBuffers.completeChunksBuffer, 'completeChunks (no indices)', RasterCompleteChunk, () => completeChunkCount );
    LOG && this.logger.logIndexed( encoder, stageBuffers.chunkIndexMapBuffer, 'chunkIndexMap', BufferLogger.RasterU32, () => numUsedClippedChunks );

    this.edgeScanShader.dispatchIndirect( encoder, [
      configBuffer,
      stageBuffers.clippedChunksBuffer,
      stageBuffers.edgeClipsBuffer,
      stageBuffers.edgeReduces0Buffer,
      stageBuffers.edgeReduces1Buffer,
      stageBuffers.edgeReduces2Buffer,
      stageBuffers.reducibleEdgesBuffer,
      stageBuffers.completeEdgesBuffer,
      stageBuffers.chunkIndicesBuffer
    ], configBuffer, 60 );

    LOG && this.logger.logIndexed( encoder, stageBuffers.reducibleEdgesBuffer, 'reducibleEdges (unmapped chunks)', RasterEdge, () => reducibleEdgeCount );
    LOG && this.logger.logIndexed( encoder, stageBuffers.completeEdgesBuffer, 'completeEdges', RasterCompleteEdge, () => completeEdgeCount );
    LOG && this.logger.logIndexed( encoder, stageBuffers.chunkIndicesBuffer, 'chunkIndices', BufferLogger.RasterU32, () => 2 * numUsedClippedChunks );

    this.chunkIndexPatchShader.dispatchIndirect( encoder, [
      configBuffer,
      stageBuffers.chunkIndexMapBuffer,
      stageBuffers.chunkIndicesBuffer,
      stageBuffers.clippedChunksBuffer,
      stageBuffers.reducibleChunksBuffer,
      stageBuffers.completeChunksBuffer
    ], configBuffer, 48 );

    LOG && this.logger.logIndexed( encoder, stageBuffers.reducibleChunksBuffer, 'reducibleChunks', RasterChunk, () => reducibleChunkCount );
    LOG && this.logger.logIndexed( encoder, stageBuffers.completeChunksBuffer, 'completeChunks', RasterCompleteChunk, () => completeChunkCount );

    this.uniformUpdateShader.dispatch( encoder, [
      stageBuffers.splitReduces2Buffer,
      stageBuffers.edgeReduces2Buffer,
      configBuffer
    ], 1, 1, 1 );

    LOG && this.logger.logIndexed( encoder, configBuffer, 'config', BufferLogger.RasterU32, () => CONFIG_NUM_WORDS );

    this.edgeIndexPatchShader.dispatchIndirect( encoder, [
      configBuffer,
      stageBuffers.chunkIndexMapBuffer,
      stageBuffers.chunkIndicesBuffer,
      stageBuffers.reducibleEdgesBuffer
    ], configBuffer, 12 );

    LOG && this.logger.logIndexed( encoder, stageBuffers.reducibleEdgesBuffer, 'reducibleEdges', RasterEdge, () => reducibleEdgeCount );
    // LOG && this.logger.logIndexed( encoder, completeEdgesBuffer, 'completeEdges', RasterCompleteEdge, () => completeEdgeCount );

    this.accumulateShader.dispatchIndirect( encoder, [
      configBuffer,
      instructionsBuffer,
      stageBuffers.completeChunksBuffer,
      stageBuffers.completeEdgesBuffer,
      accumulationBuffer,
      ...( stageBuffers.debugAccumulationBuffer ? [ stageBuffers.debugAccumulationBuffer ] : [] )
    ], configBuffer, 120 );

    // LOG && this.logger.logIndexed( encoder, accumulationBuffer, 'accumulation', BufferLogger.RasterF32, () => 4 * rasterSize * rasterSize );
    if ( stageBuffers.debugAccumulationBuffer ) {
      LOG && this.logger.logIndexed( encoder, stageBuffers.debugAccumulationBuffer, 'debugAccumulation', BufferLogger.RasterI32, () => completeChunkCount );
    }
  }
}

alpenglow.register( 'RasterClipper', RasterClipper );

class StageBuffers {

  public readonly clippedChunksBuffer: GPUBuffer;
  public readonly edgeClipsBuffer: GPUBuffer;
  public readonly chunkReduces0Buffer: GPUBuffer;
  public readonly debugChunkReduces0Buffer: GPUBuffer | null = null;
  public readonly chunkReduces1Buffer: GPUBuffer;
  public readonly chunkReduces2Buffer: GPUBuffer;
  public readonly splitReduces0Buffer: GPUBuffer;
  public readonly debugInitialSplitReduceBuffer: GPUBuffer | null = null;
  public readonly edgeReduces0Buffer: GPUBuffer;
  public readonly debugInitialEdgeReduceBuffer: GPUBuffer | null = null;
  public readonly splitReduces1Buffer: GPUBuffer;
  public readonly splitReduces2Buffer: GPUBuffer;
  public readonly edgeReduces1Buffer: GPUBuffer;
  public readonly edgeReduces2Buffer: GPUBuffer;
  public readonly reducibleChunksBuffer: GPUBuffer;
  public readonly completeChunksBuffer: GPUBuffer;
  public readonly chunkIndexMapBuffer: GPUBuffer;
  public readonly debugSplitScanReducesBuffer: GPUBuffer | null = null;
  public readonly reducibleEdgesBuffer: GPUBuffer;
  public readonly completeEdgesBuffer: GPUBuffer;
  public readonly chunkIndicesBuffer: GPUBuffer;
  public readonly debugAccumulationBuffer: GPUBuffer | null = null;

  public constructor( deviceContext: DeviceContext, bufferExponent: number ) {
    const workgroupSize = WORKGROUP_SIZE;

    const MAX_EXPONENT = bufferExponent;
    const MAX_COMPLETE_CHUNKS = 2 ** MAX_EXPONENT;
    const MAX_COMPLETE_EDGES = 2 ** MAX_EXPONENT;

    const MAX_CHUNKS = 2 ** MAX_EXPONENT;
    const MAX_EDGES = 2 ** MAX_EXPONENT;
    const MAX_CLIPPED_CHUNKS = 2 * MAX_CHUNKS;
    const MAX_EDGE_CLIPS = 2 * MAX_EDGES;

    this.clippedChunksBuffer = deviceContext.createBuffer(
      RasterClippedChunk.ENCODING_BYTE_LENGTH * MAX_CLIPPED_CHUNKS
    );

    this.edgeClipsBuffer = deviceContext.createBuffer(
      RasterEdgeClip.ENCODING_BYTE_LENGTH * MAX_EDGE_CLIPS
    );
    this.chunkReduces0Buffer = deviceContext.createBuffer(
      RasterChunkReduceQuad.ENCODING_BYTE_LENGTH * Math.ceil( MAX_EDGES / workgroupSize )
    );
    if ( DEBUG_REDUCE_BUFFERS ) {
      this.debugChunkReduces0Buffer = deviceContext.createBuffer(
        RasterChunkReducePair.ENCODING_BYTE_LENGTH * MAX_EDGES
      );
    }

    this.chunkReduces1Buffer = deviceContext.createBuffer(
      RasterChunkReduceQuad.ENCODING_BYTE_LENGTH * Math.ceil( MAX_EDGES / ( workgroupSize * workgroupSize ) )
    );

    // TODO: don't even have these buffers! We probably need a second shader for that, no?
    // TODO: Just make it tiny
    this.chunkReduces2Buffer = deviceContext.createBuffer(
      RasterChunkReduceQuad.ENCODING_BYTE_LENGTH * Math.ceil( MAX_EDGES / ( workgroupSize * workgroupSize * workgroupSize ) )
    );

    this.splitReduces0Buffer = deviceContext.createBuffer(
      RasterSplitReduceData.ENCODING_BYTE_LENGTH * Math.ceil( MAX_CLIPPED_CHUNKS / workgroupSize )
    );
    if ( DEBUG_REDUCE_BUFFERS ) {
      this.debugInitialSplitReduceBuffer = deviceContext.createBuffer(
        RasterSplitReduceData.ENCODING_BYTE_LENGTH * MAX_CLIPPED_CHUNKS
      );
    }

    this.edgeReduces0Buffer = deviceContext.createBuffer(
      RasterSplitReduceData.ENCODING_BYTE_LENGTH * Math.ceil( MAX_EDGE_CLIPS / workgroupSize )
    );
    if ( DEBUG_REDUCE_BUFFERS ) {
      this.debugInitialEdgeReduceBuffer = deviceContext.createBuffer(
        RasterSplitReduceData.ENCODING_BYTE_LENGTH * MAX_EDGE_CLIPS
      );
    }

    this.splitReduces1Buffer = deviceContext.createBuffer(
      RasterSplitReduceData.ENCODING_BYTE_LENGTH * Math.ceil( MAX_CLIPPED_CHUNKS / ( workgroupSize * workgroupSize ) )
    );
    this.splitReduces2Buffer = deviceContext.createBuffer(
      RasterSplitReduceData.ENCODING_BYTE_LENGTH * Math.ceil( MAX_CLIPPED_CHUNKS / ( workgroupSize * workgroupSize * workgroupSize ) )
    );

    this.edgeReduces1Buffer = deviceContext.createBuffer(
      RasterSplitReduceData.ENCODING_BYTE_LENGTH * Math.ceil( MAX_EDGE_CLIPS / ( workgroupSize * workgroupSize ) )
    );
    this.edgeReduces2Buffer = deviceContext.createBuffer(
      RasterSplitReduceData.ENCODING_BYTE_LENGTH * Math.ceil( MAX_EDGE_CLIPS / ( workgroupSize * workgroupSize * workgroupSize ) )
    );

    this.reducibleChunksBuffer = deviceContext.createBuffer(
      RasterChunk.ENCODING_BYTE_LENGTH * MAX_CLIPPED_CHUNKS
    );
    this.completeChunksBuffer = deviceContext.createBuffer(
      RasterCompleteChunk.ENCODING_BYTE_LENGTH * MAX_COMPLETE_CHUNKS
    );
    this.chunkIndexMapBuffer = deviceContext.createBuffer(
      4 * MAX_CLIPPED_CHUNKS
    );
    if ( DEBUG_REDUCE_BUFFERS ) {
      this.debugSplitScanReducesBuffer = deviceContext.createBuffer(
        RasterSplitReduceData.ENCODING_BYTE_LENGTH * MAX_CLIPPED_CHUNKS
      );
    }

    this.reducibleEdgesBuffer = deviceContext.createBuffer(
      RasterEdge.ENCODING_BYTE_LENGTH * MAX_EDGE_CLIPS
    );
    this.completeEdgesBuffer = deviceContext.createBuffer(
      RasterCompleteEdge.ENCODING_BYTE_LENGTH * MAX_COMPLETE_EDGES
    );
    this.chunkIndicesBuffer = deviceContext.createBuffer(
      4 * 2 * MAX_CLIPPED_CHUNKS
    );

    if ( DEBUG_ACCUMULATION ) {
      this.debugAccumulationBuffer = deviceContext.createBuffer(
        4 * MAX_COMPLETE_CHUNKS
      );
    }
  }

  public destroy(): void {
    this.clippedChunksBuffer.destroy();
    this.edgeClipsBuffer.destroy();
    this.chunkReduces0Buffer.destroy();
    this.debugChunkReduces0Buffer && this.debugChunkReduces0Buffer.destroy();
    this.chunkReduces1Buffer.destroy();
    this.chunkReduces2Buffer.destroy();
    this.splitReduces0Buffer.destroy();
    this.debugInitialSplitReduceBuffer && this.debugInitialSplitReduceBuffer.destroy();
    this.edgeReduces0Buffer.destroy();
    this.debugInitialEdgeReduceBuffer && this.debugInitialEdgeReduceBuffer.destroy();
    this.splitReduces1Buffer.destroy();
    this.splitReduces2Buffer.destroy();
    this.edgeReduces1Buffer.destroy();
    this.edgeReduces2Buffer.destroy();
    this.reducibleChunksBuffer.destroy();
    this.completeChunksBuffer.destroy();
    this.chunkIndexMapBuffer.destroy();
    this.debugSplitScanReducesBuffer && this.debugSplitScanReducesBuffer.destroy();
    this.reducibleEdgesBuffer.destroy();
    this.completeEdgesBuffer.destroy();
    this.chunkIndicesBuffer.destroy();
    this.debugAccumulationBuffer && this.debugAccumulationBuffer.destroy();
  }
}