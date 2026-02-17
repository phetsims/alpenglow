// Copyright 2024-2025, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import Vector3 from '../../../../../dot/js/Vector3.js';
import { combineOptions } from '../../../../../phet-core/js/optionize.js';
import { alpenglow } from '../../../alpenglow.js';
import type { TwoPassConfig } from '../../wgsl/rasterize-two-pass/TwoPassConfig.js';
import type { BufferSlot } from '../../compute/BufferSlot.js';
import type { TwoPassFineRenderableFace } from '../../wgsl/rasterize-two-pass/TwoPassFineRenderableFace.js';
import { LinearEdge } from '../../../cag/LinearEdge.js';
import { TextureViewSlot } from '../../compute/TextureViewSlot.js';
import { MAIN_TWO_PASS_FINE_DEFAULTS, mainTwoPassFineWGSL, mainTwoPassFineWGSLOptions } from '../../wgsl/rasterize-two-pass/mainTwoPassFineWGSL.js';
import type { PipelineBlueprintOptions } from '../../compute/PipelineBlueprint.js';
import { DIRECT_MODULE_DEFAULTS, DirectModule, DirectModuleOptions } from '../../compute/DirectModule.js';

export type MainTwoPassFineModuleOptions = {
  config: BufferSlot<TwoPassConfig>;
  addresses: BufferSlot<number[]>;
  fineRenderableFaces: BufferSlot<TwoPassFineRenderableFace[]>;
  renderProgramInstructions: BufferSlot<number[]>;
  edges: BufferSlot<LinearEdge[]>;
  output: TextureViewSlot;
} & mainTwoPassFineWGSLOptions & PipelineBlueprintOptions;

export const MAIN_TWO_PASS_FINE_MODULE_DEFAULTS = {
  // eslint-disable-next-line phet/no-object-spread-on-non-literals
  ...DIRECT_MODULE_DEFAULTS,
  // eslint-disable-next-line phet/no-object-spread-on-non-literals
  ...MAIN_TWO_PASS_FINE_DEFAULTS
} as const;

// inputSize: number - numBins (!)
export class MainTwoPassFineModule extends DirectModule<number> {

  public readonly config: BufferSlot<TwoPassConfig>;
  public readonly addresses: BufferSlot<number[]>;
  public readonly fineRenderableFaces: BufferSlot<TwoPassFineRenderableFace[]>;
  public readonly renderProgramInstructions: BufferSlot<number[]>;
  public readonly edges: BufferSlot<LinearEdge[]>;
  public readonly output: TextureViewSlot;

  public constructor(
    providedOptions: MainTwoPassFineModuleOptions
  ) {
    const options = combineOptions<MainTwoPassFineModuleOptions & DirectModuleOptions<number>>( {
      main: mainTwoPassFineWGSL( providedOptions ),
      setDispatchSize: ( dispatchSize: Vector3, numBins: number ) => {
        dispatchSize.x = numBins;
      }
    }, providedOptions );

    super( options );

    this.config = options.config;
    this.addresses = options.addresses;
    this.fineRenderableFaces = options.fineRenderableFaces;
    this.renderProgramInstructions = options.renderProgramInstructions;
    this.edges = options.edges;
    this.output = options.output;
  }
}
alpenglow.register( 'MainTwoPassFineModule', MainTwoPassFineModule );