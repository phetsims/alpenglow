// Copyright 2024, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BufferSlot, DIRECT_MODULE_DEFAULTS, DirectModule, DirectModuleOptions, LinearEdge, MAIN_TWO_PASS_COARSE_DEFAULTS, mainTwoPassCoarseWGSL, mainTwoPassCoarseWGSLOptions, PipelineBlueprintOptions, TwoPassCoarseRenderableFace, TwoPassConfig, TwoPassFineRenderableFace } from '../../../imports.js';
import Vector3 from '../../../../../dot/js/Vector3.js';
import { combineOptions } from '../../../../../phet-core/js/optionize.js';

export type MainTwoPassCoarseModuleOptions = {
  // input
  config: BufferSlot<TwoPassConfig>;
  coarseRenderableFaces: BufferSlot<TwoPassCoarseRenderableFace[]>;
  coarseEdges: BufferSlot<LinearEdge[]>;

  // output
  fineRenderableFaces: BufferSlot<TwoPassFineRenderableFace[]>;
  fineEdges: BufferSlot<LinearEdge[]>;
  addresses: BufferSlot<number[]>; // note: first atomic is face-allocation, second is edge-allocation
} & mainTwoPassCoarseWGSLOptions & PipelineBlueprintOptions;

export const MAIN_TWO_PASS_COARSE_MODULE_DEFAULTS = {
  // eslint-disable-next-line phet/no-object-spread-on-non-literals
  ...DIRECT_MODULE_DEFAULTS,
  // eslint-disable-next-line phet/no-object-spread-on-non-literals
  ...MAIN_TWO_PASS_COARSE_DEFAULTS
} as const;

// inputSize: number - numRenderableFaces
export default class MainTwoPassCoarseModule extends DirectModule<number> {

  // input
  public readonly config: BufferSlot<TwoPassConfig>;
  public readonly coarseRenderableFaces: BufferSlot<TwoPassCoarseRenderableFace[]>;
  public readonly coarseEdges: BufferSlot<LinearEdge[]>;

  // output
  public readonly fineRenderableFaces: BufferSlot<TwoPassFineRenderableFace[]>;
  public readonly fineEdges: BufferSlot<LinearEdge[]>;
  public readonly addresses: BufferSlot<number[]>; // note: first atomic is face-allocation, second is edge-allocation

  public constructor(
    providedOptions: MainTwoPassCoarseModuleOptions
  ) {
    const options = combineOptions<MainTwoPassCoarseModuleOptions & DirectModuleOptions<number>>( {
      main: mainTwoPassCoarseWGSL( providedOptions ),
      setDispatchSize: ( dispatchSize: Vector3, numRenderableFaces: number ) => {
        dispatchSize.x = numRenderableFaces;
      }
    }, providedOptions );

    super( options );

    this.config = options.config;
    this.coarseRenderableFaces = options.coarseRenderableFaces;
    this.coarseEdges = options.coarseEdges;
    this.fineRenderableFaces = options.fineRenderableFaces;
    this.fineEdges = options.fineEdges;
    this.addresses = options.addresses;
  }
}
alpenglow.register( 'MainTwoPassCoarseModule', MainTwoPassCoarseModule );