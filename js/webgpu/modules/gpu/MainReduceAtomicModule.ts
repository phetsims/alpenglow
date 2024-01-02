// Copyright 2023, University of Colorado Boulder

/**
 * Meant for reduction on u32/i32 values (could be generalized to things that can be represented with multiple atomic
 * values, haven't run into that yet).
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BufferArraySlot, BufferSlot, DIRECT_MODULE_DEFAULTS, DirectModule, DirectModuleOptions, MAIN_REDUCE_ATOMIC_DEFAULTS, mainReduceAtomicWGSL, mainReduceAtomicWGSLOptions } from '../../../imports.js';
import Vector3 from '../../../../../dot/js/Vector3.js';

type SelfOptions<T> = {
  input: BufferArraySlot<T>;
  output: BufferSlot<T>;
} & mainReduceAtomicWGSLOptions<T>; // TODO: pass in context to lengthExpression

export type MainReduceAtomicModuleOptions<T> = SelfOptions<T> & DirectModuleOptions<number>;

export const MAIN_REDUCE_ATOMIC_MODULE_DEFAULTS = {
  // eslint-disable-next-line no-object-spread-on-non-literals
  ...DIRECT_MODULE_DEFAULTS,
  // eslint-disable-next-line no-object-spread-on-non-literals
  ...MAIN_REDUCE_ATOMIC_DEFAULTS
} as const;

// stageInputSize: number
export default class MainReduceAtomicModule<T> extends DirectModule<number> {

  public readonly input: BufferArraySlot<T>;
  public readonly output: BufferSlot<T>;

  public constructor(
    options: MainReduceAtomicModuleOptions<T>
  ) {
    assert && assert( !options.setup );
    options.setup = blueprint => mainReduceAtomicWGSL<T>( blueprint, options );

    assert && assert( !options.setDispatchSize );
    options.setDispatchSize = ( dispatchSize: Vector3, stageInputSize: number ) => {
      dispatchSize.x = Math.ceil( stageInputSize / ( options.workgroupSize * options.grainSize ) );
    };

    super( options );

    this.input = options.input;
    this.output = options.output;
  }
}
alpenglow.register( 'MainReduceAtomicModule', MainReduceAtomicModule );
