// Copyright 2023-2024, University of Colorado Boulder

/**
 * A single level of standalone reduction for non-commutative types.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import Vector3 from '../../../../../dot/js/Vector3.js';
import { combineOptions } from '../../../../../phet-core/js/optionize.js';
import { alpenglow, BufferArraySlot, DIRECT_MODULE_DEFAULTS, DirectModule, DirectModuleOptions, MAIN_REDUCE_NON_COMMUTATIVE_DEFAULTS, mainReduceNonCommutativeWGSL, mainReduceNonCommutativeWGSLOptions, PipelineBlueprintOptions } from '../../../imports.js';

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
export default class MainReduceNonCommutativeModule<T> extends DirectModule<number> {

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