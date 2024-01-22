// Copyright 2024, University of Colorado Boulder

/**
 * Saves a striped histogram into memory (for use in a radix sort).
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BufferArraySlot, DIRECT_MODULE_DEFAULTS, DirectModule, DirectModuleOptions, MAIN_RADIX_HISTOGRAM_DEFAULTS, mainRadixHistogramWGSL, mainRadixHistogramWGSLOptions, PipelineBlueprintOptions } from '../../../imports.js';
import Vector3 from '../../../../../dot/js/Vector3.js';
import { combineOptions } from '../../../../../phet-core/js/optionize.js';

export type MainRadixHistogramModuleOptions<T> = {
  input: BufferArraySlot<T>;
  output: BufferArraySlot<number>;
} & mainRadixHistogramWGSLOptions<T> & PipelineBlueprintOptions;

export const MAIN_RADIX_HISTOGRAM_MODULE_DEFAULTS = {
  // eslint-disable-next-line no-object-spread-on-non-literals
  ...DIRECT_MODULE_DEFAULTS,
  // eslint-disable-next-line no-object-spread-on-non-literals
  ...MAIN_RADIX_HISTOGRAM_DEFAULTS
} as const;

// inputSize: number
export default class MainRadixHistogramModule<T> extends DirectModule<number> {

  public readonly input: BufferArraySlot<T>;
  public readonly output: BufferArraySlot<number>;

  public constructor(
    providedOptions: MainRadixHistogramModuleOptions<T>
  ) {
    const options = combineOptions<MainRadixHistogramModuleOptions<T> & DirectModuleOptions<number>>( {
      main: mainRadixHistogramWGSL( providedOptions ),
      setDispatchSize: ( dispatchSize: Vector3, inputSize: number ) => {
        dispatchSize.x = Math.ceil( inputSize / ( providedOptions.workgroupSize * providedOptions.grainSize ) );
      }
    }, providedOptions );

    super( options );

    this.input = options.input;
    this.output = options.output;
  }
}
alpenglow.register( 'MainRadixHistogramModule', MainRadixHistogramModule );
