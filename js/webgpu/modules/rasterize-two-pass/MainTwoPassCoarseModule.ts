// Copyright 2024-2026, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import Vector3 from '../../../../../dot/js/Vector3.js';
import { combineOptions } from '../../../../../phet-core/js/optionize.js';
import { alpenglow } from '../../../alpenglow.js';
import type { BufferSlot } from '../../compute/BufferSlot.js';
import { TwoPassConfig } from '../../wgsl/rasterize-two-pass/TwoPassConfig.js';
import { TwoPassCoarseRenderableFace } from '../../wgsl/rasterize-two-pass/TwoPassCoarseRenderableFace.js';
import { LinearEdge } from '../../../cag/LinearEdge.js';
import { TwoPassFineRenderableFace } from '../../wgsl/rasterize-two-pass/TwoPassFineRenderableFace.js';
import { MAIN_TWO_PASS_COARSE_DEFAULTS, mainTwoPassCoarseWGSL, mainTwoPassCoarseWGSLOptions } from '../../wgsl/rasterize-two-pass/mainTwoPassCoarseWGSL.js';
import { PipelineBlueprintOptions } from '../../compute/PipelineBlueprint.js';
import { DIRECT_MODULE_DEFAULTS, DirectModule, DirectModuleOptions } from '../../compute/DirectModule.js';

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
export class MainTwoPassCoarseModule extends DirectModule<number> {

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