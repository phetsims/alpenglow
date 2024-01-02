// Copyright 2023-2024, University of Colorado Boulder

/**
 * A single level of standalone reduction for non-commutative types.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BinaryOp, BufferArraySlot, DIRECT_MODULE_DEFAULTS, DirectModule, DirectModuleOptions, mainReduceNonCommutativeWGSL, mainReduceNonCommutativeWGSLOptions } from '../../../imports.js';
import { combineOptions, optionize3 } from '../../../../../phet-core/js/optionize.js';
import StrictOmit from '../../../../../phet-core/js/types/StrictOmit.js';
import Vector3 from '../../../../../dot/js/Vector3.js';

type SelfOptions<T> = {
  input: BufferArraySlot<T>;
  output: BufferArraySlot<T>;
  binaryOp: BinaryOp<T>;

  workgroupSize: number;
  grainSize: number;
  lengthExpression: string; // TODO: we'll need ability to pass in context

  mainReduceNonCommutativeWGSLOptions?: StrictOmit<mainReduceNonCommutativeWGSLOptions<T>, 'input' | 'output' | 'binaryOp' | 'workgroupSize' | 'grainSize'>;
};

export type MainReduceNonCommutativeModuleOptions<T> = SelfOptions<T> & StrictOmit<DirectModuleOptions<T>, 'setup' | 'setDispatchSize'>;

export const MAIN_REDUCE_NON_COMMUTATIVE_MODULE_DEFAULTS = {
  // eslint-disable-next-line no-object-spread-on-non-literals
  ...DIRECT_MODULE_DEFAULTS,

  mainReduceNonCommutativeWGSLOptions: {}
} as const;

// stageInputSize: number
export default class MainReduceNonCommutativeModule<T> extends DirectModule<number> {

  public readonly input: BufferArraySlot<T>;
  public readonly output: BufferArraySlot<T>;

  public constructor(
    providedOptions: MainReduceNonCommutativeModuleOptions<T>
  ) {
    // @ts-expect-error TODO: ask MK about this
    const options = optionize3<MainReduceNonCommutativeModuleOptions<T>, SelfOptions<T>, DirectModuleOptions<number>>()( {}, MAIN_REDUCE_NON_COMMUTATIVE_MODULE_DEFAULTS, providedOptions );

    options.setup = blueprint => mainReduceNonCommutativeWGSL<T>( blueprint, combineOptions<mainReduceNonCommutativeWGSLOptions<T>>( {
      input: providedOptions.input,
      output: providedOptions.output,
      binaryOp: providedOptions.binaryOp,
      workgroupSize: providedOptions.workgroupSize,
      grainSize: providedOptions.grainSize
    }, providedOptions.mainReduceNonCommutativeWGSLOptions ) );

    options.setDispatchSize = ( dispatchSize: Vector3, stageInputSize: number ) => {
      dispatchSize.x = Math.ceil( stageInputSize / ( providedOptions.workgroupSize * providedOptions.grainSize ) );
    };

    super( options );

    this.input = providedOptions.input;
    this.output = providedOptions.output;
  }
}
alpenglow.register( 'MainReduceNonCommutativeModule', MainReduceNonCommutativeModule );
