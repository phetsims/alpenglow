// Copyright 2024, University of Colorado Boulder

/**
 * Merges two sorted arrays into a single sorted array.
 *
 * TODO: DO we... really want this wrapper type? Can we collapse these into one?
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BufferArraySlot, CompareOrder, CompositeModule, ExecutionContext, MainMergeSimpleModule, MainMergeSimpleModuleOptions, PipelineBlueprint, WGSLExpressionU32 } from '../../../imports.js';
import { combineOptions, optionize3 } from '../../../../../phet-core/js/optionize.js';

type SelfOptions<T> = {
  inputA: BufferArraySlot<T>;
  inputB: BufferArraySlot<T>;
  output: BufferArraySlot<T>;

  order: CompareOrder<T>;

  workgroupSize: number;
  grainSize: number;

  lengthExpressionA: ( pipeline: PipelineBlueprint ) => WGSLExpressionU32; // TODO: support optional
  lengthExpressionB: ( pipeline: PipelineBlueprint ) => WGSLExpressionU32; // TODO: support optional

  name?: string;
  log?: boolean;
};

export type MergeSimpleModuleOptions<T> = SelfOptions<T>;

export const MERGE_SIMPLE_MODULE_DEFAULTS = {
  name: 'merge simple',
  log: false // TODO: how to deduplicate this? - We don't really need all of the defaults, right?
} as const;

// outputSize: number (sum of inputASize and inputBSize)
export default class MergeSimpleModule<T> extends CompositeModule<number> {

  public readonly inputA: BufferArraySlot<T>;
  public readonly inputB: BufferArraySlot<T>;
  public readonly output: BufferArraySlot<T>;

  public constructor(
    providedOptions: MergeSimpleModuleOptions<T>
  ) {
    const options = optionize3<MergeSimpleModuleOptions<T>, SelfOptions<T>>()( {}, MERGE_SIMPLE_MODULE_DEFAULTS, providedOptions );

    const module = new MainMergeSimpleModule( combineOptions<MainMergeSimpleModuleOptions<T>>( {
      name: `${options.name} main`,
      log: options.log,
      inputA: options.inputA,
      inputB: options.inputB,
      output: options.output,
      order: options.order,
      workgroupSize: options.workgroupSize,
      grainSize: options.grainSize,
      lengthExpressionA: options.lengthExpressionA,
      lengthExpressionB: options.lengthExpressionB
    } ) );

    const execute = ( context: ExecutionContext, outputSize: number ) => {
      module.execute( context, outputSize );
    };

    super( [ module ], execute );

    this.inputA = providedOptions.inputA;
    this.inputB = providedOptions.inputB;
    this.output = providedOptions.output;
  }
}
alpenglow.register( 'MergeSimpleModule', MergeSimpleModule );
