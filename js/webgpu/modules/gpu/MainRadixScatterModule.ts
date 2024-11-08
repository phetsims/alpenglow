// Copyright 2024, University of Colorado Boulder

/**
 * Uses a scanned histogram to perform a step of the radix sort.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import Vector3 from '../../../../../dot/js/Vector3.js';
import { combineOptions } from '../../../../../phet-core/js/optionize.js';
import { alpenglow, BufferArraySlot, DIRECT_MODULE_DEFAULTS, DirectModule, DirectModuleOptions, MAIN_RADIX_SCATTER_DEFAULTS, mainRadixScatterWGSL, mainRadixScatterWGSLOptions, PipelineBlueprintOptions } from '../../../imports.js';

export type MainRadixScatterModuleOptions<T> = {
  input: BufferArraySlot<T>;
  output: BufferArraySlot<T>;
} & mainRadixScatterWGSLOptions<T> & PipelineBlueprintOptions;

export const MAIN_RADIX_SCATTER_MODULE_DEFAULTS = {
  // eslint-disable-next-line phet/no-object-spread-on-non-literals
  ...DIRECT_MODULE_DEFAULTS,
  // eslint-disable-next-line phet/no-object-spread-on-non-literals
  ...MAIN_RADIX_SCATTER_DEFAULTS
} as const;

// inputSize: number
export default class MainRadixScatterModule<T> extends DirectModule<number> {

  public readonly input: BufferArraySlot<T>;
  public readonly output: BufferArraySlot<T>;

  public constructor(
    providedOptions: MainRadixScatterModuleOptions<T>
  ) {
    const options = combineOptions<MainRadixScatterModuleOptions<T> & DirectModuleOptions<number>>( {
      main: mainRadixScatterWGSL( providedOptions ),
      setDispatchSize: ( dispatchSize: Vector3, inputSize: number ) => {
        dispatchSize.x = Math.ceil( inputSize / ( providedOptions.workgroupSize * providedOptions.grainSize ) );
      }
    }, providedOptions );

    super( options );

    this.input = options.input;
    this.output = options.output;
  }
}
alpenglow.register( 'MainRadixScatterModule', MainRadixScatterModule );