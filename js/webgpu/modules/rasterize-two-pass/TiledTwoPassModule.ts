// Copyright 2024, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BufferArraySlot, BufferBindingType, BufferSlot, CompositeModule, getVariableLengthArrayType, LinearEdge, LinearEdgeType, MainTwoPassInitializeAddressesModule, MainTwoPassInitializeAddressesModuleOptions, MainTwoPassTileModule, MainTwoPassTileModuleOptions, PipelineBlueprintOptions, TextureViewSlot, TwoPassCoarseRenderableFaceType, TwoPassConfig, TwoPassInitialRenderableFace, TwoPassModule, TwoPassModuleOptions, U32AtomicType, U32Type, WGSLExpressionU32, WGSLStringFunction } from '../../../imports.js';
import { optionize3 } from '../../../../../phet-core/js/optionize.js';

type SelfOptions = {
  config: BufferSlot<TwoPassConfig>;
  initialRenderableFaces: BufferSlot<TwoPassInitialRenderableFace[]>;
  initialEdges: BufferSlot<LinearEdge[]>;
  renderProgramInstructions: BufferSlot<number[]>;
  output: TextureViewSlot;

  storageFormat: GPUTextureFormat; // e.g. deviceContext.preferredStorageFormat

  numInitialRenderableFaces: WGSLExpressionU32;
  maxCoarseRenderableFaces?: number;
  maxCoarseEdges?: number;
};

type ParentOptions = {
  mainTwoPassTileModuleOptions?: Partial<MainTwoPassTileModuleOptions>;
  twoPassModuleOptions?: Partial<TwoPassModuleOptions>;
  mainTwoPassAtomicInitializeAddressesModuleOptions?: Partial<MainTwoPassInitializeAddressesModuleOptions>;
} & PipelineBlueprintOptions;

export type TiledTwoPassModuleOptions = SelfOptions & ParentOptions;

export const TILED_TWO_PASS_MODULE_DEFAULTS = {
  mainTwoPassTileModuleOptions: {},
  twoPassModuleOptions: {},
  mainTwoPassAtomicInitializeAddressesModuleOptions: {},
  maxCoarseRenderableFaces: 2 ** 15,
  maxCoarseEdges: 2 ** 18
} as const;

export type TiledTwoPassRunSize = {
  numTiles: number;
  numBins: number;
  numInitialRenderableFaces: number;
};

// inputSize: TiledTwoPassRunSize
export default class TiledTwoPassModule extends CompositeModule<TiledTwoPassRunSize> {

  public readonly config: BufferSlot<TwoPassConfig>;
  public readonly initialRenderableFaces: BufferSlot<TwoPassInitialRenderableFace[]>;
  public readonly initialEdges: BufferSlot<LinearEdge[]>;
  public readonly renderProgramInstructions: BufferSlot<number[]>;
  public readonly output: TextureViewSlot;

  public readonly initializeAddressesModule: MainTwoPassInitializeAddressesModule;
  public readonly tileModule: MainTwoPassTileModule;
  public readonly twoPassModule: TwoPassModule;

  public constructor(
    providedOptions: TiledTwoPassModuleOptions
  ) {
    const options = optionize3<TiledTwoPassModuleOptions, SelfOptions>()( {}, TILED_TWO_PASS_MODULE_DEFAULTS, providedOptions );

    const ATOMIC_SIZE = 4; // padded up so it will be the min of 16 bytes

    const coarseRenderableFacesSlot = new BufferArraySlot( getVariableLengthArrayType( TwoPassCoarseRenderableFaceType, options.maxCoarseRenderableFaces ) );
    const coarseEdgesSlot = new BufferArraySlot( getVariableLengthArrayType( LinearEdgeType, options.maxCoarseEdges ) );
    const addressesAtomicSlot = new BufferArraySlot( getVariableLengthArrayType( U32AtomicType, ATOMIC_SIZE ) );
    const addressesPlainSlot = addressesAtomicSlot.castTo( getVariableLengthArrayType( U32Type, ATOMIC_SIZE ) );

    const initializeAddressesModule = new MainTwoPassInitializeAddressesModule( {
      name: `${providedOptions.name} atomic initialize_addresses`,

      log: providedOptions.log, // TODO: how can we avoid needing this forward?
      ...options.mainTwoPassAtomicInitializeAddressesModuleOptions, // eslint-disable-line phet/no-object-spread-on-non-literals

      addresses: addressesPlainSlot
    } );

    const tileModule = new MainTwoPassTileModule( {
      name: `${providedOptions.name} tile`,

      log: providedOptions.log, // TODO: how can we avoid needing this forward?
      numInitialRenderableFaces: options.numInitialRenderableFaces,
      ...options.mainTwoPassTileModuleOptions, // eslint-disable-line phet/no-object-spread-on-non-literals

      // input
      config: providedOptions.config,
      initialRenderableFaces: providedOptions.initialRenderableFaces,
      initialEdges: providedOptions.initialEdges,

      // output
      coarseRenderableFaces: coarseRenderableFacesSlot,
      coarseEdges: coarseEdgesSlot,
      addresses: addressesAtomicSlot
    } );

    const twoPassModule = new TwoPassModule( {
      name: `${providedOptions.name} two pass`,

      log: providedOptions.log, // TODO: how can we avoid needing this forward?
      ...options.twoPassModuleOptions, // eslint-disable-line phet/no-object-spread-on-non-literals

      config: providedOptions.config,
      coarseRenderableFaces: coarseRenderableFacesSlot,
      coarseEdges: coarseEdgesSlot,
      renderProgramInstructions: providedOptions.renderProgramInstructions,
      output: providedOptions.output,

      storageFormat: providedOptions.storageFormat,

      numCoarseRenderableFaces: new WGSLStringFunction( pipelineBlueprint => {
        pipelineBlueprint.addSlot( 'tile_addresses', addressesPlainSlot, BufferBindingType.READ_ONLY_STORAGE );

        return 'tile_addresses[ 0u ]';
      } )
    } );

    super( [
      initializeAddressesModule,
      tileModule,
      twoPassModule
    ], ( context, runSize: TiledTwoPassRunSize ) => {
      initializeAddressesModule.execute( context, 0 );
      tileModule.execute( context, runSize.numInitialRenderableFaces * runSize.numTiles );
      twoPassModule.execute( context, {
        numBins: runSize.numBins,
        numCoarseRenderableFaces: options.maxCoarseRenderableFaces
      } );
    } );

    this.config = providedOptions.config;
    this.initialRenderableFaces = providedOptions.initialRenderableFaces;
    this.initialEdges = providedOptions.initialEdges;
    this.renderProgramInstructions = providedOptions.renderProgramInstructions;
    this.output = providedOptions.output;

    this.initializeAddressesModule = initializeAddressesModule;
    this.tileModule = tileModule;
    this.twoPassModule = twoPassModule;
  }
}
alpenglow.register( 'TiledTwoPassModule', TiledTwoPassModule );