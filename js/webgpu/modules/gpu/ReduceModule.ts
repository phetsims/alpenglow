// Copyright 2023, University of Colorado Boulder

/**
 * A single level of standalone reduction.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BinaryOp, BufferArraySlot, ceilDivideConstantDivisorWGSL, CompositeModule, getArrayType, MAIN_REDUCE_MODULE_DEFAULTS, MainReduceModule, MainReduceModuleOptions } from '../../../imports.js';
import { combineOptions, optionize3 } from '../../../../../phet-core/js/optionize.js';

type SelfOptions<T> = {
  input: BufferArraySlot<T>;
  output: BufferArraySlot<T>;
  binaryOp: BinaryOp<T>;

  workgroupSize: number;
  grainSize: number;
  lengthExpression: string; // TODO: we'll need ability to pass in context

  // TODO: instead of these, get fusable data operators
  inputOrder?: 'blocked' | 'striped';
  inputAccessOrder?: 'blocked' | 'striped';

  name?: string;
  log?: boolean;
};

type ParentOptions<T> = {
  mainReduceWGSLOptions?: MainReduceModuleOptions<T>;
};

export type ReduceModuleOptions<T> = SelfOptions<T> & ParentOptions<T>;

export const REDUCE_MODULE_DEFAULTS = {
  name: 'reduce',
  log: false, // TODO: how to deduplicate this?
  inputOrder: 'blocked',
  inputAccessOrder: 'striped',
  mainReduceWGSLOptions: MAIN_REDUCE_MODULE_DEFAULTS
} as const;

// stageInputSize: number
export default class ReduceModule<T> extends CompositeModule<number> {

  public readonly input: BufferArraySlot<T>;
  public readonly output: BufferArraySlot<T>;
  public readonly slots: BufferArraySlot<T>[];
  public readonly internalSlots: BufferArraySlot<T>[];

  public constructor(
    providedOptions: ReduceModuleOptions<T>
  ) {
    const options = optionize3<ReduceModuleOptions<T>, SelfOptions<T>>()( {}, REDUCE_MODULE_DEFAULTS, providedOptions );

    const perStageReduction = options.workgroupSize * options.grainSize;
    const initialStageInputSize = options.input.length;
    const numStages = Math.ceil( Math.log2( initialStageInputSize ) / Math.log2( perStageReduction ) );
    assert && assert( numStages > 0, 'Do not pass in a single-element input' );

    // TODO: detect the atomic case(!)

    // TODO: should we "stripe" the next layer of data?

    const internalSlots: BufferArraySlot<T>[] = _.range( 0, numStages - 1 ).map( i => {
      return new BufferArraySlot( getArrayType( options.binaryOp.type, Math.ceil( initialStageInputSize / ( perStageReduction ** ( i + 1 ) ) ), options.binaryOp.identity ) );
    } );

    const slots = [
      options.input,
      ...internalSlots,
      options.output
    ];

    const modules = _.range( 0, numStages ).map( i => {
      return new MainReduceModule( combineOptions<MainReduceModuleOptions<T>>( {
        name: `${options.name} ${i}`,
        log: options.log,
        input: slots[ i ],
        output: slots[ i + 1 ],
        binaryOp: options.binaryOp,
        workgroupSize: options.workgroupSize,
        grainSize: options.grainSize,
        loadReducedOptions: {
          lengthExpression: ceilDivideConstantDivisorWGSL( options.lengthExpression, perStageReduction ** i ),
          inputOrder: options.inputOrder,
          inputAccessOrder: options.inputAccessOrder
        },
        reduceOptions: {
          convergent: options.binaryOp.isCommutative
        }
      }, options.mainReduceWGSLOptions ) );
    } );

    super( modules, ( context, inputSize: number ) => {
      let stageInputSize = inputSize;

      for ( let i = 0; i < modules.length; i++ ) {
        modules[ i ].execute( context, stageInputSize );
        stageInputSize = Math.ceil( stageInputSize / perStageReduction );
      }
    } );

    this.input = providedOptions.input;
    this.output = providedOptions.output;
    this.slots = slots;
    this.internalSlots = internalSlots;
  }
}
alpenglow.register( 'ReduceModule', ReduceModule );
