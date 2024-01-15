// Copyright 2024, University of Colorado Boulder

/**
 * Applies a simple merge operation to two sorted arrays.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BufferArraySlot, DIRECT_MODULE_DEFAULTS, DirectModule, DirectModuleOptions, MAIN_MERGE_SIMPLE_DEFAULTS, mainMergeSimpleWGSL, mainMergeSimpleWGSLOptions } from '../../../imports.js';
import Vector3 from '../../../../../dot/js/Vector3.js';

type SelfOptions<T> = {
  inputA: BufferArraySlot<T>;
  inputB: BufferArraySlot<T>;
  output: BufferArraySlot<T>;
} & mainMergeSimpleWGSLOptions<T>; // TODO: pass in context to lengthExpression

export type MainMergeSimpleModuleOptions<T> = SelfOptions<T> & DirectModuleOptions<number>;

export const MAIN_MERGE_SIMPLE_MODULE_DEFAULTS = {
  // eslint-disable-next-line no-object-spread-on-non-literals
  ...DIRECT_MODULE_DEFAULTS,
  // eslint-disable-next-line no-object-spread-on-non-literals
  ...MAIN_MERGE_SIMPLE_DEFAULTS
} as const;

// outputSize: number (sum of inputASize and inputBSize)
export default class MainMergeSimpleModule<T> extends DirectModule<number> {

  public readonly inputA: BufferArraySlot<T>;
  public readonly inputB: BufferArraySlot<T>;
  public readonly output: BufferArraySlot<T>;

  public constructor(
    options: MainMergeSimpleModuleOptions<T>
  ) {
    assert && assert( !options.setup );
    options.setup = blueprint => mainMergeSimpleWGSL<T>( blueprint, options );

    assert && assert( !options.setDispatchSize );
    options.setDispatchSize = ( dispatchSize: Vector3, outputSize: number ) => {
      dispatchSize.x = Math.ceil( outputSize / ( options.workgroupSize * options.grainSize ) );
    };

    super( options );

    this.inputA = options.inputA;
    this.inputB = options.inputB;
    this.output = options.output;
  }
}
alpenglow.register( 'MainMergeSimpleModule', MainMergeSimpleModule );
