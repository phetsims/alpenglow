// Copyright 2024, University of Colorado Boulder

/**
 * Merges two sorted arrays into a single sorted array.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BufferArraySlot, DIRECT_MODULE_DEFAULTS, DirectModule, DirectModuleOptions, MAIN_MERGE_DEFAULTS, mainMergeWGSL, mainMergeWGSLOptions, PipelineBlueprintOptions } from '../../../imports.js';
import { combineOptions } from '../../../../../phet-core/js/optionize.js';
import Vector3 from '../../../../../dot/js/Vector3.js';

export type MergeModuleOptions<T> = {
  inputA: BufferArraySlot<T>;
  inputB: BufferArraySlot<T>;
  output: BufferArraySlot<T>;
} & mainMergeWGSLOptions<T> & PipelineBlueprintOptions;

export const MERGE_MODULE_DEFAULTS = {
  // eslint-disable-next-line no-object-spread-on-non-literals
  ...DIRECT_MODULE_DEFAULTS,
  // eslint-disable-next-line no-object-spread-on-non-literals
  ...MAIN_MERGE_DEFAULTS
} as const;

// outputSize: number (sum of inputASize and inputBSize)
export default class MergeModule<T> extends DirectModule<number> {

  public readonly inputA: BufferArraySlot<T>;
  public readonly inputB: BufferArraySlot<T>;
  public readonly output: BufferArraySlot<T>;

  public constructor(
    providedOptions: MergeModuleOptions<T>
  ) {
    const options = combineOptions<MergeModuleOptions<T> & DirectModuleOptions<number>>( {
      main: mainMergeWGSL( providedOptions ),
      setDispatchSize: ( dispatchSize: Vector3, outputSize: number ) => {
        dispatchSize.x = Math.ceil( outputSize / providedOptions.blockOutputSize );
      }
    }, providedOptions );

    super( options );

    this.inputA = providedOptions.inputA;
    this.inputB = providedOptions.inputB;
    this.output = providedOptions.output;
  }
}
alpenglow.register( 'MergeModule', MergeModule );