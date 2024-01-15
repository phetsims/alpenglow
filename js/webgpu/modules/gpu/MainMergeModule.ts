// Copyright 2024, University of Colorado Boulder

/**
 * Applies a merge operation to two sorted arrays.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BufferArraySlot, DIRECT_MODULE_DEFAULTS, DirectModule, DirectModuleOptions, MAIN_MERGE_DEFAULTS, mainMergeWGSL, mainMergeWGSLOptions } from '../../../imports.js';
import Vector3 from '../../../../../dot/js/Vector3.js';

type SelfOptions<T> = {
  inputA: BufferArraySlot<T>;
  inputB: BufferArraySlot<T>;
  output: BufferArraySlot<T>;
} & mainMergeWGSLOptions<T>; // TODO: pass in context to lengthExpression

export type MainMergeModuleOptions<T> = SelfOptions<T> & DirectModuleOptions<number>;

export const MAIN_MERGE_MODULE_DEFAULTS = {
  // eslint-disable-next-line no-object-spread-on-non-literals
  ...DIRECT_MODULE_DEFAULTS,
  // eslint-disable-next-line no-object-spread-on-non-literals
  ...MAIN_MERGE_DEFAULTS
} as const;

// outputSize: number (sum of inputASize and inputBSize)
export default class MainMergeModule<T> extends DirectModule<number> {

  public readonly inputA: BufferArraySlot<T>;
  public readonly inputB: BufferArraySlot<T>;
  public readonly output: BufferArraySlot<T>;

  public constructor(
    options: MainMergeModuleOptions<T>
  ) {
    assert && assert( !options.setup );
    options.setup = blueprint => mainMergeWGSL<T>( blueprint, options );

    assert && assert( !options.setDispatchSize );
    options.setDispatchSize = ( dispatchSize: Vector3, outputSize: number ) => {
      dispatchSize.x = Math.ceil( outputSize / options.blockOutputSize );
    };

    super( options );

    this.inputA = options.inputA;
    this.inputB = options.inputB;
    this.output = options.output;
  }
}
alpenglow.register( 'MainMergeModule', MainMergeModule );
