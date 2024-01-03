// Copyright 2023, University of Colorado Boulder

/**
 * Saves a striped histogram into memory (for use in a radix sort).
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BufferArraySlot, DIRECT_MODULE_DEFAULTS, DirectModule, DirectModuleOptions, MAIN_RADIX_HISTOGRAM_DEFAULTS, mainRadixHistogramWGSL, mainRadixHistogramWGSLOptions } from '../../../imports.js';
import Vector3 from '../../../../../dot/js/Vector3.js';

type SelfOptions<T> = {
  input: BufferArraySlot<T>;
  output: BufferArraySlot<number>;
} & mainRadixHistogramWGSLOptions<T>; // TODO: pass in context to lengthExpression

export type MainRadixHistogramModuleOptions<T> = SelfOptions<T> & DirectModuleOptions<number>;

export const MAIN_RADIX_HISTOGRAM_MODULE_DEFAULTS = {
  // eslint-disable-next-line no-object-spread-on-non-literals
  ...DIRECT_MODULE_DEFAULTS,
  // eslint-disable-next-line no-object-spread-on-non-literals
  ...MAIN_RADIX_HISTOGRAM_DEFAULTS
} as const;

// stageInputSize: number
export default class MainRadixHistogramModule<T> extends DirectModule<number> {

  public readonly input: BufferArraySlot<T>;
  public readonly output: BufferArraySlot<number>;

  public constructor(
    options: MainRadixHistogramModuleOptions<T>
  ) {
    assert && assert( !options.setup );
    options.setup = blueprint => mainRadixHistogramWGSL<T>( blueprint, options );

    assert && assert( !options.setDispatchSize );
    options.setDispatchSize = ( dispatchSize: Vector3, stageInputSize: number ) => {
      dispatchSize.x = Math.ceil( stageInputSize / ( options.workgroupSize * options.grainSize ) );
    };

    super( options );

    this.input = options.input;
    this.output = options.output;
  }
}
alpenglow.register( 'MainRadixHistogramModule', MainRadixHistogramModule );
