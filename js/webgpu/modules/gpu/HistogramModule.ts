// Copyright 2024, University of Colorado Boulder

/**
 * Applies a histogram operation to an array.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BufferArraySlot, DIRECT_MODULE_DEFAULTS, DirectModule, DirectModuleOptions, MAIN_HISTOGRAM_DEFAULTS, mainHistogramWGSL, mainHistogramWGSLOptions, PipelineBlueprintOptions } from '../../../imports.js';
import Vector3 from '../../../../../dot/js/Vector3.js';
import { combineOptions } from '../../../../../phet-core/js/optionize.js';

export type HistogramModuleOptions<T> = {
  input: BufferArraySlot<T>;
  output: BufferArraySlot<number>;
} & mainHistogramWGSLOptions<T> & PipelineBlueprintOptions;

export const HISTOGRAM_MODULE_DEFAULTS = {
  // eslint-disable-next-line phet/no-object-spread-on-non-literals
  ...DIRECT_MODULE_DEFAULTS,
  // eslint-disable-next-line phet/no-object-spread-on-non-literals
  ...MAIN_HISTOGRAM_DEFAULTS
} as const;

// inputSize: number
export default class HistogramModule<T> extends DirectModule<number> {

  public readonly input: BufferArraySlot<T>;
  public readonly output: BufferArraySlot<number>;

  public constructor(
    providedOptions: HistogramModuleOptions<T>
  ) {
    const options = combineOptions<HistogramModuleOptions<T> & DirectModuleOptions<number>>( {
      main: mainHistogramWGSL( providedOptions ),
      setDispatchSize: ( dispatchSize: Vector3, inputSize: number ) => {
        dispatchSize.x = Math.ceil( inputSize / ( providedOptions.workgroupSize * providedOptions.grainSize ) );
      }
    }, providedOptions );

    super( options );

    this.input = options.input;
    this.output = options.output;
  }
}
alpenglow.register( 'HistogramModule', HistogramModule );