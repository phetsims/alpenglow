// Copyright 2024, University of Colorado Boulder

import { alpenglow, BlitShader, BufferArraySlot, BufferBindingType, BufferSlot, ByteEncoder, CompositeModule, DeviceContext, getArrayType, LinearEdge, LinearEdgeType, PolygonFilterType, Procedure, RasterizationOptions, Rasterize, RenderableFace, RenderColor, RenderInstruction, RenderProgram, Routine, TextureViewResource, TextureViewSlot, TiledTwoPassModule, TwoPassConfig, TwoPassConfigType, TwoPassInitialRenderableFace, TwoPassInitialRenderableFaceType, U32Type, WGSLStringFunction } from '../imports.js';
import { optionize3 } from '../../../phet-core/js/optionize.js';
import Bounds2 from '../../../dot/js/Bounds2.js';

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

export type FaceRasterizerOptions = {
  deviceContext: DeviceContext;

  supportsGridFiltering?: boolean;
  supportsBilinear?: boolean;
  supportsMitchellNetravali?: boolean;

  // TODO: add limits support for everything nested
  maxRenderableFaces?: number;
  maxInitialEdges?: number;
  maxRenderProgramInstructions?: number;
};

export const FACE_RASTERIZER_DEFAULT_OPTIONS = {
  supportsGridFiltering: true,
  supportsBilinear: true,
  supportsMitchellNetravali: false,

  maxRenderableFaces: 2 ** 12,
  maxInitialEdges: 2 ** 15,
  maxRenderProgramInstructions: 2 ** 14
} as const;

export type FaceRasterizerRunOptions = {
  // TODO: ideally run with no tile size (large!)
  renderableFaces: RenderableFace[];
  canvasContext: GPUCanvasContext;
  rasterWidth: number;
  rasterHeight: number;
  colorSpace?: 'srgb' | 'display-p3';
  filterType?: PolygonFilterType;
  filterScale?: number;
};

export const FACE_RASTERIZER_RUN_DEFAULT_OPTIONS = {
  filterType: PolygonFilterType.Box,
  filterScale: 1,
  colorSpace: 'srgb'
} as const;

export type FaceRasterizerExecutionInfo = {
  config: TwoPassConfig;
  numBins: number;
  initialRenderableFaces: TwoPassInitialRenderableFace[];
  initialEdges: LinearEdge[];
  renderProgramInstructions: number[];
  textureBlit: [ GPUTextureView, GPUTextureView ] | null;
};

export default class FaceRasterizer {

  private readonly device: GPUDevice;
  private readonly deviceContext: DeviceContext;
  private readonly supportsGridFiltering: boolean;
  private readonly supportsBilinear: boolean;
  private readonly supportsMitchellNetravali: boolean;

  private readonly maxRenderableFaces: number;
  private readonly maxInitialEdges: number;
  private readonly maxRenderProgramInstructions: number;

  private readonly initializationPromise: Promise<void>;

  private readonly outputSlot = new TextureViewSlot();
  private procedure!: Procedure<FaceRasterizerExecutionInfo, null>; // created in initialize

  public constructor(
    providedOptions: FaceRasterizerOptions
  ) {
    const options = optionize3<FaceRasterizerOptions>()( {}, FACE_RASTERIZER_DEFAULT_OPTIONS, providedOptions );

    this.deviceContext = options.deviceContext;
    this.device = this.deviceContext.device;
    this.supportsGridFiltering = options.supportsGridFiltering;
    this.supportsBilinear = options.supportsBilinear;
    this.supportsMitchellNetravali = options.supportsMitchellNetravali;

    this.maxRenderableFaces = options.maxRenderableFaces;
    this.maxInitialEdges = options.maxInitialEdges;
    this.maxRenderProgramInstructions = options.maxRenderProgramInstructions;

    this.initializationPromise = this.initialize();
  }

  private async initialize(): Promise<void> {

    const configSlot = new BufferSlot( TwoPassConfigType );
    const runUniformsSlot = new BufferSlot( U32Type );
    // TODO: variable sizes!!!
    const initialRenderableFacesSlot = new BufferArraySlot( getArrayType( TwoPassInitialRenderableFaceType, this.maxRenderableFaces ) );
    const initialEdgesSlot = new BufferArraySlot( getArrayType( LinearEdgeType, this.maxInitialEdges ) );
    const renderProgramInstructionsSlot = new BufferArraySlot( getArrayType( U32Type, this.maxRenderProgramInstructions ) );

    const mainModule = new TiledTwoPassModule( {
      name: `module_${name}`,
      // log: true,
      config: configSlot,
      initialRenderableFaces: initialRenderableFacesSlot,
      initialEdges: initialEdgesSlot,
      renderProgramInstructions: renderProgramInstructionsSlot,
      output: this.outputSlot,
      storageFormat: this.deviceContext.preferredStorageFormat, // e.g. deviceContext.preferredStorageFormat
      twoPassModuleOptions: {
        mainTwoPassFineModuleOptions: {
          supportsGridFiltering: this.supportsGridFiltering,
          supportsBilinear: this.supportsBilinear,
          supportsMitchellNetravali: this.supportsMitchellNetravali
        }
      },
      numInitialRenderableFaces: new WGSLStringFunction( pipelineBlueprint => {
        pipelineBlueprint.addSlot( 'run_uniforms', runUniformsSlot, BufferBindingType.UNIFORM );

        return 'run_uniforms';
      } )
    } );

    // Pick the opposite of the storage format, in case we can't write to it directly, and need to blit it over
    const potentialBlitFormat = this.deviceContext.preferredStorageFormat === 'bgra8unorm' ? 'rgba8unorm' : 'bgra8unorm';
    const blitShader = new BlitShader( this.deviceContext.device, potentialBlitFormat );
    const wrapBlitModule = new CompositeModule( [ mainModule ], ( context, data: { numBins: number; numInitialRenderableFaces: number; textureBlit: [ GPUTextureView, GPUTextureView ] | null } ) => {
      mainModule.execute( context, {
        numBins: data.numBins,
        numInitialRenderableFaces: data.numInitialRenderableFaces
      } );

      if ( data.textureBlit ) {
        const encoder = context.getEncoderForCustomRender();
        blitShader.dispatch( encoder, data.textureBlit[ 1 ], data.textureBlit[ 0 ] );
      }
    } );

    const routine = await Routine.create(
      this.deviceContext,
      wrapBlitModule,
      [ configSlot, initialRenderableFacesSlot, initialEdgesSlot, renderProgramInstructionsSlot ],
      Routine.INDIVIDUAL_LAYOUT_STRATEGY,
      async ( context, execute, input: FaceRasterizerExecutionInfo ) => {
        // console.log( 'coarse faces', input.coarseRenderableFaces );
        // console.log( 'coarse edges', input.coarseEdges );

        context.setTypedBufferValue( configSlot, input.config );
        context.setTypedBufferValue( runUniformsSlot, input.initialRenderableFaces.length );
        context.setTypedBufferValue( initialRenderableFacesSlot, input.initialRenderableFaces );
        context.setTypedBufferValue( initialEdgesSlot, input.initialEdges );
        context.setTypedBufferValue( renderProgramInstructionsSlot, input.renderProgramInstructions );

        execute( context, {
          numBins: input.numBins,
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

    const procedure = new Procedure( routine ).bindRemainingBuffers();

    this.procedure = procedure;
  }

  public getCanvasContext( canvas: HTMLCanvasElement, colorSpace: 'srgb' | 'display-p3' ): GPUCanvasContext {
    // TODO: note, possible to reconfigure?
    return this.deviceContext.getCanvasContext( canvas, colorSpace );
  }

  private static getFilterExpansion( options: Required<FaceRasterizerRunOptions> ): number {

    const filterRadius = {
      [ PolygonFilterType.Box ]: 0.5,
      [ PolygonFilterType.Bilinear ]: 1,
      [ PolygonFilterType.MitchellNetravali ]: 2
    }[ options.filterType ] * options.filterScale;

    return filterRadius - 0.5; // since our "bounds" already include a radius of 0.5 from the pixel centers
  }

  public async runRenderProgram(
    program: RenderProgram,
    providedRunOptions: FaceRasterizerRunOptions,
    rasterizeOptions?: RasterizationOptions
  ): Promise<void> {

    // TODO: avoid extra optionize somehow?
    const runOptions = optionize3<FaceRasterizerRunOptions>()( {}, FACE_RASTERIZER_RUN_DEFAULT_OPTIONS, providedRunOptions );
    const filterRadius = FaceRasterizer.getFilterExpansion( runOptions );

    const bounds = new Bounds2( 0, 0, runOptions.rasterWidth, runOptions.rasterHeight ).dilated( filterRadius ).roundedOut();

    const renderableFaces = Rasterize.partitionRenderableFaces( program, bounds, {
      tileSize: 1024 * 1024, // don't do tiles by default

      // eslint-disable-next-line no-object-spread-on-non-literals
      ...rasterizeOptions
    } );

    return this.run( {
      // eslint-disable-next-line no-object-spread-on-non-literals
      ...runOptions,
      renderableFaces: renderableFaces
    } );
  }

  public async run(
    providedOptions: FaceRasterizerRunOptions
  ): Promise<void> {

    // First, ensure we've completed our WebGPU init
    await this.initializationPromise;

    const options = optionize3<FaceRasterizerRunOptions>()( {}, FACE_RASTERIZER_RUN_DEFAULT_OPTIONS, providedOptions );

    const rasterWidth = options.rasterWidth;
    const rasterHeight = options.rasterHeight;

    const binSize = ( this.supportsGridFiltering && options.filterScale === 1 ) ? {
      [ PolygonFilterType.Box ]: 16,
      [ PolygonFilterType.Bilinear ]: 15,
      [ PolygonFilterType.MitchellNetravali ]: 13
    }[ options.filterType ] : 16;
    const tileSize = 16 * binSize;

    const tileWidth = Math.ceil( rasterWidth / tileSize );
    const tileHeight = Math.ceil( rasterHeight / tileSize );

    const binWidth = Math.ceil( rasterWidth / binSize );
    const binHeight = Math.ceil( rasterHeight / binSize );

    const numBins = 256 * tileWidth * tileHeight;

    const initialRenderableFaces: TwoPassInitialRenderableFace[] = [];
    const initialEdges: LinearEdge[] = [];
    const instructionsEncoder = new ByteEncoder();

    // TODO: faster encoder
    for ( const renderableFace of options.renderableFaces ) {

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

    const canvasTexture = options.canvasContext.getCurrentTexture();

    const canvasTextureFormat = canvasTexture.format;
    if ( canvasTextureFormat !== 'bgra8unorm' && canvasTextureFormat !== 'rgba8unorm' ) {
      throw new Error( 'unsupported format' );
    }

    const canOutputToCanvas = canvasTextureFormat === this.deviceContext.preferredStorageFormat;

    let fineOutputTextureView: GPUTextureView;
    let fineOutputTexture: GPUTexture | null = null;
    const canvasTextureView = canvasTexture.createView();

    if ( canOutputToCanvas ) {
      fineOutputTextureView = canvasTextureView;
    }
    else {
      // TODO: don't do this repeatedly!
      fineOutputTexture = this.deviceContext.device.createTexture( {
        label: 'fineOutputTexture',
        size: {
          width: canvasTexture.width,
          height: canvasTexture.height,
          depthOrArrayLayers: 1
        },
        format: this.deviceContext.preferredStorageFormat,
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING // see TargetTexture
      } );
      fineOutputTextureView = fineOutputTexture.createView( {
        label: 'fineOutputTextureView',
        format: this.deviceContext.preferredStorageFormat,
        dimension: '2d'
      } );
    }

    this.procedure.bindTexture( this.outputSlot, new TextureViewResource( fineOutputTextureView ) );

    await this.procedure.standaloneExecute( this.deviceContext, {
      config: {
        rasterWidth: rasterWidth,
        rasterHeight: rasterHeight,
        tileWidth: tileWidth,
        tileHeight: tileHeight,
        binWidth: binWidth,
        binHeight: binHeight,
        tileSize: tileSize,
        binSize: binSize,
        filter: options.filterType,
        filterScale: options.filterScale,
        rasterColorSpace: 0
      },
      initialRenderableFaces: initialRenderableFaces,
      initialEdges: initialEdges,
      renderProgramInstructions: renderProgramInstructions,
      textureBlit: canOutputToCanvas ? null : [ fineOutputTextureView, canvasTextureView ],
      numBins: numBins
    } );
  }

  public dispose(): void {
    this.procedure.dispose();
  }
}
alpenglow.register( 'FaceRasterizer', FaceRasterizer );