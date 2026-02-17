// Copyright 2024-2025, University of Colorado Boulder

/**
 * A single level of standalone reduction.
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import Vector3 from '../../../../../dot/js/Vector3.js';
import { combineOptions } from '../../../../../phet-core/js/optionize.js';
import { alpenglow } from '../../../alpenglow.js';
import type { BufferArraySlot } from '../../compute/BufferArraySlot.js';
import { MAIN_REDUCE_DEFAULTS, mainReduceWGSL, mainReduceWGSLOptions } from '../../wgsl/gpu/mainReduceWGSL.js';
import type { PipelineBlueprintOptions } from '../../compute/PipelineBlueprint.js';
import { DIRECT_MODULE_DEFAULTS, DirectModule, DirectModuleOptions } from '../../compute/DirectModule.js';

export type MainReduceModuleOptions<T> = {
  input: BufferArraySlot<T>;
  output: BufferArraySlot<T>;
} & mainReduceWGSLOptions<T> & PipelineBlueprintOptions;

export const MAIN_REDUCE_MODULE_DEFAULTS = {
  // eslint-disable-next-line phet/no-object-spread-on-non-literals
  ...DIRECT_MODULE_DEFAULTS,
  // eslint-disable-next-line phet/no-object-spread-on-non-literals
  ...MAIN_REDUCE_DEFAULTS
} as const;

// inputSize: number
export class MainReduceModule<T> extends DirectModule<number> {

  public readonly input: BufferArraySlot<T>;
  public readonly output: BufferArraySlot<T>;

  public constructor(
    providedOptions: MainReduceModuleOptions<T>
  ) {
    const options = combineOptions<MainReduceModuleOptions<T> & DirectModuleOptions<number>>( {
      main: mainReduceWGSL( providedOptions ),
      setDispatchSize: ( dispatchSize: Vector3, inputSize: number ) => {
        dispatchSize.x = Math.ceil( inputSize / ( providedOptions.workgroupSize * providedOptions.grainSize ) );
      }
    }, providedOptions );

    super( options );

    this.input = options.input;
    this.output = options.output;
  }
}
alpenglow.register( 'MainReduceModule', MainReduceModule );