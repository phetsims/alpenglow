// Copyright 2024, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BufferArraySlot, BufferSlot, CompositeModule, getArrayType, LinearEdge, LinearEdgeType, MainTwoPassCoarseModule, MainTwoPassCoarseModuleOptions, MainTwoPassFineModule, MainTwoPassFineModuleOptions, MainTwoPassInitializeAddressesModule, PipelineBlueprintOptions, TextureViewSlot, TwoPassCoarseRenderableFace, TwoPassConfig, TwoPassFineRenderableFaceType, U32AtomicType, U32Type } from '../../../imports.js';
import { optionize3 } from '../../../../../phet-core/js/optionize.js';

type SelfOptions = {
  config: BufferSlot<TwoPassConfig>;
  coarseRenderableFaces: BufferSlot<TwoPassCoarseRenderableFace[]>;
  coarseEdges: BufferSlot<LinearEdge[]>;
  renderProgramInstructions: BufferSlot<number[]>;
  output: TextureViewSlot;

  storageFormat: GPUTextureFormat; // e.g. deviceContext.preferredStorageFormat

  // Use mainTwoPassFineModuleOptions?
  // supportsGridFiltering?: boolean;
  // supportsBilinear?: boolean;
  // supportsMitchellNetravali?: boolean;

  // TODO: support length
  // lengthExpression: WGSLExpressionU32;
};

type ParentOptions = {
  mainTwoPassCoarseModuleOptions?: Partial<MainTwoPassCoarseModuleOptions>;
  mainTwoPassFineModuleOptions?: Partial<MainTwoPassFineModuleOptions>;
  mainTwoPassInitializeAddressesModule?: Partial<MainTwoPassInitializeAddressesModule>;
} & PipelineBlueprintOptions;

export type TwoPassModuleOptions = SelfOptions & ParentOptions;

export const TWO_PASS_MODULE_DEFAULTS = {
  mainTwoPassCoarseModuleOptions: {},
  mainTwoPassFineModuleOptions: {},
  mainTwoPassInitializeAddressesModule: {}
} as const;

export type TwoPassRunSize = {
  numBins: number;
  numCoarseRenderableFaces: number;
};

// inputSize: TwoPassRunSize
export default class TwoPassModule extends CompositeModule<TwoPassRunSize> {

  public readonly config: BufferSlot<TwoPassConfig>;
  public readonly coarseRenderableFaces: BufferSlot<TwoPassCoarseRenderableFace[]>;
  public readonly coarseEdges: BufferSlot<LinearEdge[]>;
  public readonly renderProgramInstructions: BufferSlot<number[]>;
  public readonly output: TextureViewSlot;

  public readonly initializeAddressesModule: MainTwoPassInitializeAddressesModule;
  public readonly coarseModule: MainTwoPassCoarseModule;
  public readonly fineModule: MainTwoPassFineModule;

  public constructor(
    providedOptions: TwoPassModuleOptions
  ) {
    const options = optionize3<TwoPassModuleOptions, SelfOptions>()( {}, TWO_PASS_MODULE_DEFAULTS, providedOptions );

    const MAX_FINE_FACES = 2 ** 13; // TODO: adjustable
    const MAX_FINE_EDGES = 2 ** 16; // TODO: adjustable
    const MAX_BINS = 2 ** 16; // TODO: adjustable NOTE, need 2 for atomics

    /*
  addresses: BufferSlot<number[]>; // note: first atomic is face-allocation, second is edge-allocation

  return new BufferArraySlot( getArrayType( options.binaryOp.type, Math.ceil( initialStageInputSize / ( perStageReduction ** ( i + 1 ) ) ), options.binaryOp.identity ) );
     */

    const fineRenderableFacesSlot = new BufferArraySlot( getArrayType( TwoPassFineRenderableFaceType, MAX_FINE_FACES ) );
    const fineEdgesSlot = new BufferArraySlot( getArrayType( LinearEdgeType, MAX_FINE_EDGES ) );
    const addressesAtomicSlot = new BufferArraySlot( getArrayType( U32AtomicType, MAX_BINS ) );
    const addressesPlainSlot = addressesAtomicSlot.castTo( getArrayType( U32Type, MAX_BINS ) );

    const initializeAddressesModule = new MainTwoPassInitializeAddressesModule( {
      name: `${providedOptions.name} initialize_addresses`,

      log: providedOptions.log, // TODO: how can we avoid needing this forward?
      ...options.mainTwoPassInitializeAddressesModule, // eslint-disable-line no-object-spread-on-non-literals

      addresses: addressesPlainSlot
    } );

    const coarseModule = new MainTwoPassCoarseModule( {
      name: `${providedOptions.name} coarse`,

      log: providedOptions.log, // TODO: how can we avoid needing this forward?
      ...options.mainTwoPassCoarseModuleOptions, // eslint-disable-line no-object-spread-on-non-literals

      // input
      config: providedOptions.config,
      coarseRenderableFaces: providedOptions.coarseRenderableFaces,
      coarseEdges: providedOptions.coarseEdges,

      // output
      fineRenderableFaces: fineRenderableFacesSlot,
      fineEdges: fineEdgesSlot,
      addresses: addressesAtomicSlot
    } );

    const fineModule = new MainTwoPassFineModule( {
      name: `${providedOptions.name} fine`,

      log: providedOptions.log, // TODO: how can we avoid needing this forward?
      ...options.mainTwoPassFineModuleOptions, // eslint-disable-line no-object-spread-on-non-literals

      config: providedOptions.config,
      addresses: addressesPlainSlot,
      fineRenderableFaces: fineRenderableFacesSlot,
      renderProgramInstructions: providedOptions.renderProgramInstructions,
      edges: fineEdgesSlot,
      output: providedOptions.output,

      storageFormat: providedOptions.storageFormat
    } );

    super( [
      initializeAddressesModule,
      coarseModule,
      fineModule
    ], ( context, runSize: TwoPassRunSize ) => {
      initializeAddressesModule.execute( context, runSize.numBins );
      coarseModule.execute( context, runSize.numCoarseRenderableFaces );
      fineModule.execute( context, runSize.numBins );
    } );

    this.config = providedOptions.config;
    this.coarseRenderableFaces = providedOptions.coarseRenderableFaces;
    this.coarseEdges = providedOptions.coarseEdges;
    this.renderProgramInstructions = providedOptions.renderProgramInstructions;
    this.output = providedOptions.output;

    this.initializeAddressesModule = initializeAddressesModule;
    this.coarseModule = coarseModule;
    this.fineModule = fineModule;
  }
}
alpenglow.register( 'TwoPassModule', TwoPassModule );