// Copyright 2024, University of Colorado Boulder

/**
 * Merges two sorted arrays into a single sorted array (with a simpler algorithm than MergeModule).
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BufferArraySlot, DIRECT_MODULE_DEFAULTS, DirectModule, DirectModuleOptions, MAIN_MERGE_SIMPLE_DEFAULTS, mainMergeSimpleWGSL, mainMergeSimpleWGSLOptions, PipelineBlueprintOptions } from '../../../imports.js';
import { combineOptions } from '../../../../../phet-core/js/optionize.js';
import Vector3 from '../../../../../dot/js/Vector3.js';

export type MergeSimpleModuleOptions<T> = {
  inputA: BufferArraySlot<T>;
  inputB: BufferArraySlot<T>;
  output: BufferArraySlot<T>;
} & mainMergeSimpleWGSLOptions<T> & PipelineBlueprintOptions;

export const MERGE_SIMPLE_MODULE_DEFAULTS = {
  // eslint-disable-next-line no-object-spread-on-non-literals
  ...DIRECT_MODULE_DEFAULTS,
  // eslint-disable-next-line no-object-spread-on-non-literals
  ...MAIN_MERGE_SIMPLE_DEFAULTS
} as const;

// outputSize: number (sum of inputASize and inputBSize)
export default class MergeSimpleModule<T> extends DirectModule<number> {

  public readonly inputA: BufferArraySlot<T>;
  public readonly inputB: BufferArraySlot<T>;
  public readonly output: BufferArraySlot<T>;

  public constructor(
    providedOptions: MergeSimpleModuleOptions<T>
  ) {
    const options = combineOptions<MergeSimpleModuleOptions<T> & DirectModuleOptions<number>>( {
      main: mainMergeSimpleWGSL( providedOptions ),
      setDispatchSize: ( dispatchSize: Vector3, outputSize: number ) => {
        dispatchSize.x = Math.ceil( outputSize / ( providedOptions.workgroupSize * providedOptions.grainSize ) );
      }
    }, providedOptions );

    super( options );

    this.inputA = providedOptions.inputA;
    this.inputB = providedOptions.inputB;
    this.output = providedOptions.output;
  }
}
alpenglow.register( 'MergeSimpleModule', MergeSimpleModule );
