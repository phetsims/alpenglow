// Copyright 2024, University of Colorado Boulder

/**
 * Meant for reduction on u32/i32 values (could be generalized to things that can be represented with multiple atomic
 * values, haven't run into that yet).
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import Vector3 from '../../../../../dot/js/Vector3.js';
import { combineOptions } from '../../../../../phet-core/js/optionize.js';
import { alpenglow, BufferArraySlot, BufferSlot, DIRECT_MODULE_DEFAULTS, DirectModule, DirectModuleOptions, MAIN_REDUCE_ATOMIC_DEFAULTS, mainReduceAtomicWGSL, mainReduceAtomicWGSLOptions, PipelineBlueprintOptions } from '../../../imports.js';

export type MainReduceAtomicModuleOptions<T> = {
  input: BufferArraySlot<T>;
  output: BufferSlot<T>;
} & mainReduceAtomicWGSLOptions<T> & PipelineBlueprintOptions;

export const MAIN_REDUCE_ATOMIC_MODULE_DEFAULTS = {
  // eslint-disable-next-line phet/no-object-spread-on-non-literals
  ...DIRECT_MODULE_DEFAULTS,
  // eslint-disable-next-line phet/no-object-spread-on-non-literals
  ...MAIN_REDUCE_ATOMIC_DEFAULTS
} as const;

// inputSize: number
export default class MainReduceAtomicModule<T> extends DirectModule<number> {

  public readonly input: BufferArraySlot<T>;
  public readonly output: BufferSlot<T>;

  public constructor(
    providedOptions: MainReduceAtomicModuleOptions<T>
  ) {
    const options = combineOptions<MainReduceAtomicModuleOptions<T> & DirectModuleOptions<number>>( {
      main: mainReduceAtomicWGSL( providedOptions ),
      setDispatchSize: ( dispatchSize: Vector3, inputSize: number ) => {
        dispatchSize.x = Math.ceil( inputSize / ( providedOptions.workgroupSize * providedOptions.grainSize ) );
      }
    }, providedOptions );

    super( options );

    this.input = options.input;
    this.output = options.output;
  }
}
alpenglow.register( 'MainReduceAtomicModule', MainReduceAtomicModule );