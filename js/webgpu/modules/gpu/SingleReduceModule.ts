// Copyright 2023, University of Colorado Boulder

/**
 * A single level of standalone reduction.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BinaryOp, BufferArraySlot, DIRECT_MODULE_DEFAULTS, DirectModule, DirectModuleOptions, mainReduceWGSL } from '../../../imports.js';
import { optionize3 } from '../../../../../phet-core/js/optionize.js';
import StrictOmit from '../../../../../phet-core/js/types/StrictOmit.js';
import Vector3 from '../../../../../dot/js/Vector3.js';

type SelfOptions<T> = {
  input: BufferArraySlot<T>;
  output: BufferArraySlot<T>;
  binaryOp: BinaryOp<T>;

  workgroupSize: number;
  grainSize: number;
  lengthExpression: string; // TODO: we'll need ability to pass in context
};

export type SingleReduceModuleOptions<T> = SelfOptions<T> & StrictOmit<DirectModuleOptions<T>, 'setup' | 'setDispatchSize'>;

export const SINGLE_REDUCE_MODULE_DEFAULTS = {
  // eslint-disable-next-line no-object-spread-on-non-literals
  ...DIRECT_MODULE_DEFAULTS
} as const;

// stageInputSize: number
export default class SingleReduceModule<T> extends DirectModule<number> {

  public readonly input: BufferArraySlot<T>;
  public readonly output: BufferArraySlot<T>;

  public constructor(
    providedOptions: SingleReduceModuleOptions<T>
  ) {
    // @ts-expect-error TODO: ask MK about this
    const options = optionize3<SingleReduceModuleOptions<T>, SelfOptions<T>, DirectModuleOptions<number>>()( {}, SINGLE_REDUCE_MODULE_DEFAULTS, providedOptions );

    options.setup = blueprint => mainReduceWGSL<T>( blueprint, {
      input: providedOptions.input,
      output: providedOptions.output,
      binaryOp: providedOptions.binaryOp,
      workgroupSize: providedOptions.workgroupSize,
      grainSize: providedOptions.grainSize,
      loadReducedOptions: {
        lengthExpression: providedOptions.lengthExpression
      }
    } );

    options.setDispatchSize = ( dispatchSize: Vector3, stageInputSize: number ) => {
      dispatchSize.x = Math.ceil( stageInputSize / ( providedOptions.workgroupSize * providedOptions.grainSize ) );
    };

    super( options );

    this.input = providedOptions.input;
    this.output = providedOptions.output;
  }
}
alpenglow.register( 'SingleReduceModule', SingleReduceModule );
