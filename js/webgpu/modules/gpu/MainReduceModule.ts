// Copyright 2024, University of Colorado Boulder

/**
 * A single level of standalone reduction.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BufferArraySlot, DIRECT_MODULE_DEFAULTS, DirectModule, DirectModuleOptions, MAIN_REDUCE_DEFAULTS, mainReduceWGSL, mainReduceWGSLOptions } from '../../../imports.js';
import Vector3 from '../../../../../dot/js/Vector3.js';

type SelfOptions<T> = {
  input: BufferArraySlot<T>;
  output: BufferArraySlot<T>;
} & mainReduceWGSLOptions<T>; // TODO: pass in context to lengthExpression

export type MainReduceModuleOptions<T> = SelfOptions<T> & DirectModuleOptions<number>;

export const MAIN_REDUCE_MODULE_DEFAULTS = {
  // eslint-disable-next-line no-object-spread-on-non-literals
  ...DIRECT_MODULE_DEFAULTS,
  // eslint-disable-next-line no-object-spread-on-non-literals
  ...MAIN_REDUCE_DEFAULTS
} as const;

// stageInputSize: number
export default class MainReduceModule<T> extends DirectModule<number> {

  public readonly input: BufferArraySlot<T>;
  public readonly output: BufferArraySlot<T>;

  public constructor(
    options: MainReduceModuleOptions<T>
  ) {
    assert && assert( !options.setup );
    options.setup = blueprint => mainReduceWGSL<T>( blueprint, options );

    assert && assert( !options.setDispatchSize );
    options.setDispatchSize = ( dispatchSize: Vector3, stageInputSize: number ) => {
      dispatchSize.x = Math.ceil( stageInputSize / ( options.workgroupSize * options.grainSize ) );
    };

    super( options );

    this.input = options.input;
    this.output = options.output;
  }
}
alpenglow.register( 'MainReduceModule', MainReduceModule );
