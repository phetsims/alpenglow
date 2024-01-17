// Copyright 2024, University of Colorado Boulder

/**
 * Merges two sorted arrays into a single sorted array.
 *
 * TODO: DO we... really want this wrapper type? Can we collapse these into one?
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BufferArraySlot, CompositeModule, ExecutionContext, MainHistogramModule, MainHistogramModuleOptions, OPTIONAL_LENGTH_EXPRESSIONABLE_DEFAULTS, OptionalLengthExpressionable, RakedSizable, WGSLExpressionT, WGSLExpressionU32 } from '../../../imports.js';
import { combineOptions, optionize3 } from '../../../../../phet-core/js/optionize.js';

type SelfOptions<T> = {
  input: BufferArraySlot<T>;
  output: BufferArraySlot<number>;

  numBins: number;
  getBin: ( value: WGSLExpressionT ) => WGSLExpressionU32; // TODO: blueprint(!)

  name?: string;
  log?: boolean;
} & OptionalLengthExpressionable & RakedSizable;

export type HistogramModuleOptions<T> = SelfOptions<T>;

export const HISTOGRAM_MODULE_DEFAULTS = {
  name: 'histogram',
  log: false, // TODO: how to deduplicate this? - We don't really need all of the defaults, right?

  // eslint-disable-next-line no-object-spread-on-non-literals
  ...OPTIONAL_LENGTH_EXPRESSIONABLE_DEFAULTS
} as const;

// outputSize: number (sum of inputASize and inputBSize)
export default class HistogramModule<T> extends CompositeModule<number> {

  public readonly input: BufferArraySlot<T>;
  public readonly output: BufferArraySlot<number>;

  public constructor(
    providedOptions: HistogramModuleOptions<T>
  ) {
    const options = optionize3<HistogramModuleOptions<T>, SelfOptions<T>>()( {}, HISTOGRAM_MODULE_DEFAULTS, providedOptions );

    const module = new MainHistogramModule( combineOptions<MainHistogramModuleOptions<T>>( {
      name: `${options.name} main`,
      log: options.log,
      input: options.input,
      output: options.output,
      numBins: options.numBins,
      getBin: options.getBin,
      workgroupSize: options.workgroupSize,
      grainSize: options.grainSize,
      lengthExpression: options.lengthExpression
    } ) );

    const execute = ( context: ExecutionContext, outputSize: number ) => {
      module.execute( context, outputSize );
    };

    super( [ module ], execute );

    this.input = providedOptions.input;
    this.output = providedOptions.output;
  }
}
alpenglow.register( 'HistogramModule', HistogramModule );
