// Copyright 2024, University of Colorado Boulder

/**
 * Applies a histogram operation to an array.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BufferArraySlot, DIRECT_MODULE_DEFAULTS, DirectModule, DirectModuleOptions, MAIN_HISTOGRAM_DEFAULTS, mainHistogramWGSL, mainHistogramWGSLOptions } from '../../../imports.js';
import Vector3 from '../../../../../dot/js/Vector3.js';

type SelfOptions<T> = {
  input: BufferArraySlot<T>;
  output: BufferArraySlot<number>;
} & mainHistogramWGSLOptions<T>; // TODO: pass in context to lengthExpression

export type MainHistogramModuleOptions<T> = SelfOptions<T> & DirectModuleOptions<number>;

export const MAIN_HISTOGRAM_MODULE_DEFAULTS = {
  // eslint-disable-next-line no-object-spread-on-non-literals
  ...DIRECT_MODULE_DEFAULTS,
  // eslint-disable-next-line no-object-spread-on-non-literals
  ...MAIN_HISTOGRAM_DEFAULTS
} as const;

// inputSize: number
export default class MainHistogramModule<T> extends DirectModule<number> {

  public readonly input: BufferArraySlot<T>;
  public readonly output: BufferArraySlot<number>;

  public constructor(
    options: MainHistogramModuleOptions<T>
  ) {
    assert && assert( !options.setup );
    options.setup = blueprint => mainHistogramWGSL<T>( blueprint, options );

    assert && assert( !options.setDispatchSize );
    options.setDispatchSize = ( dispatchSize: Vector3, outputSize: number ) => {
      dispatchSize.x = Math.ceil( outputSize / ( options.workgroupSize * options.grainSize ) );
    };

    super( options );

    this.input = options.input;
    this.output = options.output;
  }
}
alpenglow.register( 'MainHistogramModule', MainHistogramModule );
