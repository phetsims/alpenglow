// Copyright 2023-2026, University of Colorado Boulder

/**
 * A single level of standalone reduction for non-commutative types.
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import Vector3 from '../../../../../dot/js/Vector3.js';
import { combineOptions } from '../../../../../phet-core/js/optionize.js';
import { alpenglow } from '../../../alpenglow.js';
import type { BufferArraySlot } from '../../compute/BufferArraySlot.js';
import { MAIN_REDUCE_NON_COMMUTATIVE_DEFAULTS, mainReduceNonCommutativeWGSL, mainReduceNonCommutativeWGSLOptions } from '../../wgsl/gpu/mainReduceNonCommutativeWGSL.js';
import type { PipelineBlueprintOptions } from '../../compute/PipelineBlueprint.js';
import { DIRECT_MODULE_DEFAULTS, DirectModule, DirectModuleOptions } from '../../compute/DirectModule.js';

export type MainReduceNonCommutativeModuleOptions<T> = {
  input: BufferArraySlot<T>;
  output: BufferArraySlot<T>;
} & mainReduceNonCommutativeWGSLOptions<T> & PipelineBlueprintOptions;

export const MAIN_REDUCE_NON_COMMUTATIVE_MODULE_DEFAULTS = {
  // eslint-disable-next-line phet/no-object-spread-on-non-literals
  ...DIRECT_MODULE_DEFAULTS,
  // eslint-disable-next-line phet/no-object-spread-on-non-literals
  ...MAIN_REDUCE_NON_COMMUTATIVE_DEFAULTS
} as const;

// inputSize: number
export class MainReduceNonCommutativeModule<T> extends DirectModule<number> {

  public readonly input: BufferArraySlot<T>;
  public readonly output: BufferArraySlot<T>;

  public constructor(
    providedOptions: MainReduceNonCommutativeModuleOptions<T>
  ) {
    const options = combineOptions<MainReduceNonCommutativeModuleOptions<T> & DirectModuleOptions<number>>( {
      main: mainReduceNonCommutativeWGSL( providedOptions ),
      setDispatchSize: ( dispatchSize: Vector3, inputSize: number ) => {
        dispatchSize.x = Math.ceil( inputSize / ( providedOptions.workgroupSize * providedOptions.grainSize ) );
      }
    }, providedOptions );

    super( options );

    this.input = options.input;
    this.output = options.output;
  }
}
alpenglow.register( 'MainReduceNonCommutativeModule', MainReduceNonCommutativeModule );