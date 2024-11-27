// Copyright 2024, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import Vector3 from '../../../../../dot/js/Vector3.js';
import { combineOptions } from '../../../../../phet-core/js/optionize.js';
import { alpenglow, BufferSlot, DIRECT_MODULE_DEFAULTS, DirectModule, DirectModuleOptions, LinearEdge, MAIN_TWO_PASS_TILE_DEFAULTS, mainTwoPassTileWGSL, mainTwoPassTileWGSLOptions, PipelineBlueprintOptions, TwoPassCoarseRenderableFace, TwoPassConfig, TwoPassInitialRenderableFace } from '../../../imports.js';

export type MainTwoPassTileModuleOptions = {
  // input
  config: BufferSlot<TwoPassConfig>;
  initialRenderableFaces: BufferSlot<TwoPassInitialRenderableFace[]>;
  initialEdges: BufferSlot<LinearEdge[]>;

  // output
  coarseRenderableFaces: BufferSlot<TwoPassCoarseRenderableFace[]>;
  coarseEdges: BufferSlot<LinearEdge[]>;
  addresses: BufferSlot<number[]>; // note: first atomic is face-allocation, second is edge-allocation
} & mainTwoPassTileWGSLOptions & PipelineBlueprintOptions;

export const MAIN_TWO_PASS_TILE_MODULE_DEFAULTS = {
  // eslint-disable-next-line phet/no-object-spread-on-non-literals
  ...DIRECT_MODULE_DEFAULTS,
  // eslint-disable-next-line phet/no-object-spread-on-non-literals
  ...MAIN_TWO_PASS_TILE_DEFAULTS
} as const;

// inputSize: number - numRenderableFaces * numTiles
export default class MainTwoPassTileModule extends DirectModule<number> {

  // input
  public readonly config: BufferSlot<TwoPassConfig>;
  public readonly initialRenderableFaces: BufferSlot<TwoPassInitialRenderableFace[]>;
  public readonly initialEdges: BufferSlot<LinearEdge[]>;

  // output
  public readonly coarseRenderableFaces: BufferSlot<TwoPassCoarseRenderableFace[]>;
  public readonly coarseEdges: BufferSlot<LinearEdge[]>;
  public readonly addresses: BufferSlot<number[]>; // note: first atomic is face-allocation, second is edge-allocation

  public constructor(
    providedOptions: MainTwoPassTileModuleOptions
  ) {
    const options = combineOptions<MainTwoPassTileModuleOptions & DirectModuleOptions<number>>( {
      main: mainTwoPassTileWGSL( providedOptions ),
      setDispatchSize: ( dispatchSize: Vector3, numRenderableFaceTiles: number ) => {
        dispatchSize.x = Math.ceil( numRenderableFaceTiles / 256 );
      }
    }, providedOptions );

    super( options );

    this.config = options.config;
    this.initialRenderableFaces = options.initialRenderableFaces;
    this.initialEdges = options.initialEdges;
    this.coarseRenderableFaces = options.coarseRenderableFaces;
    this.coarseEdges = options.coarseEdges;
    this.addresses = options.addresses;
  }
}
alpenglow.register( 'MainTwoPassTileModule', MainTwoPassTileModule );