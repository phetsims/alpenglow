// Copyright 2024-2025, University of Colorado Boulder

/**
 * Saves a striped histogram into memory (for use in a radix sort).
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import Vector3 from '../../../../../dot/js/Vector3.js';
import { combineOptions } from '../../../../../phet-core/js/optionize.js';
import { alpenglow } from '../../../alpenglow.js';
import type { BufferArraySlot } from '../../compute/BufferArraySlot.js';
import { MAIN_RADIX_HISTOGRAM_DEFAULTS, mainRadixHistogramWGSL, mainRadixHistogramWGSLOptions } from '../../wgsl/gpu/mainRadixHistogramWGSL.js';
import type { PipelineBlueprintOptions } from '../../compute/PipelineBlueprint.js';
import { DIRECT_MODULE_DEFAULTS, DirectModule, DirectModuleOptions } from '../../compute/DirectModule.js';

export type MainRadixHistogramModuleOptions<T> = {
  input: BufferArraySlot<T>;
  output: BufferArraySlot<number>;
} & mainRadixHistogramWGSLOptions<T> & PipelineBlueprintOptions;

export const MAIN_RADIX_HISTOGRAM_MODULE_DEFAULTS = {
  // eslint-disable-next-line phet/no-object-spread-on-non-literals
  ...DIRECT_MODULE_DEFAULTS,
  // eslint-disable-next-line phet/no-object-spread-on-non-literals
  ...MAIN_RADIX_HISTOGRAM_DEFAULTS
} as const;

// inputSize: number
export class MainRadixHistogramModule<T> extends DirectModule<number> {

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