// Copyright 2024, University of Colorado Boulder

/**
 * Uses a scanned histogram to perform a step of the radix sort.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BufferArraySlot, DIRECT_MODULE_DEFAULTS, DirectModule, DirectModuleOptions, MAIN_RADIX_SCATTER_DEFAULTS, mainRadixScatterWGSL, mainRadixScatterWGSLOptions } from '../../../imports.js';
import Vector3 from '../../../../../dot/js/Vector3.js';

type SelfOptions<T> = {
  input: BufferArraySlot<T>;
  output: BufferArraySlot<T>;
} & mainRadixScatterWGSLOptions<T>; // TODO: pass in context to lengthExpression

export type MainRadixScatterModuleOptions<T> = SelfOptions<T> & DirectModuleOptions<number>;

export const MAIN_RADIX_SCATTER_MODULE_DEFAULTS = {
  // eslint-disable-next-line no-object-spread-on-non-literals
  ...DIRECT_MODULE_DEFAULTS,
  // eslint-disable-next-line no-object-spread-on-non-literals
  ...MAIN_RADIX_SCATTER_DEFAULTS
} as const;

// stageInputSize: number
export default class MainRadixScatterModule<T> extends DirectModule<number> {

  public readonly input: BufferArraySlot<T>;
  public readonly output: BufferArraySlot<T>;

  public constructor(
    options: MainRadixScatterModuleOptions<T>
  ) {
    assert && assert( !options.setup );
    options.setup = blueprint => mainRadixScatterWGSL<T>( blueprint, options );

    assert && assert( !options.setDispatchSize );
    options.setDispatchSize = ( dispatchSize: Vector3, stageInputSize: number ) => {
      dispatchSize.x = Math.ceil( stageInputSize / ( options.workgroupSize * options.grainSize ) );
    };

    super( options );

    this.input = options.input;
    this.output = options.output;
  }
}
alpenglow.register( 'MainRadixScatterModule', MainRadixScatterModule );
