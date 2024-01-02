// Copyright 2023, University of Colorado Boulder

/**
 * A single level of standalone reduction.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BinaryOp, BufferArraySlot, ceilDivideConstantDivisorWGSL, CompositeModule, ConcreteType, ExecutionContext, getArrayType, I32AtomicType, I32Type, MAIN_REDUCE_ATOMIC_MODULE_DEFAULTS, MAIN_REDUCE_MODULE_DEFAULTS, MAIN_REDUCE_NON_COMMUTATIVE_MODULE_DEFAULTS, MainReduceAtomicModule, MainReduceAtomicModuleOptions, MainReduceModule, MainReduceModuleOptions, MainReduceNonCommutativeModule, MainReduceNonCommutativeModuleOptions, Module, U32AtomicType, U32Type } from '../../../imports.js';
import { combineOptions, optionize3 } from '../../../../../phet-core/js/optionize.js';
import IntentionalAny from '../../../../../phet-core/js/types/IntentionalAny.js';

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

  allowAtomicShader?: boolean;
  allowNonCommutativeShader?: boolean;

  name?: string;
  log?: boolean;
};

type ParentOptions<T> = {
  mainReduceModuleOptions?: MainReduceModuleOptions<T>;
  mainReduceNonCommutativeModuleOptions?: MainReduceNonCommutativeModuleOptions<T>;
  mainReduceAtomicModuleOptions?: MainReduceAtomicModuleOptions<T>;
};

export type ReduceModuleOptions<T> = SelfOptions<T> & ParentOptions<T>;

export const REDUCE_MODULE_DEFAULTS = {
  name: 'reduce',
  log: false, // TODO: how to deduplicate this?
  inputOrder: 'blocked',
  inputAccessOrder: 'striped',
  allowAtomicShader: true,
  allowNonCommutativeShader: true,
  mainReduceModuleOptions: MAIN_REDUCE_MODULE_DEFAULTS,
  mainReduceNonCommutativeModuleOptions: MAIN_REDUCE_NON_COMMUTATIVE_MODULE_DEFAULTS,
  mainReduceAtomicModuleOptions: MAIN_REDUCE_ATOMIC_MODULE_DEFAULTS
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

    let modules: Module<IntentionalAny>[];
    let execute: ( context: ExecutionContext, inputSize: number ) => void;
    let slots: BufferArraySlot<T>[];
    let internalSlots: BufferArraySlot<T>[];

    // TODO: generalize to "atomic"-able types
    const isU32Type = options.binaryOp.type as unknown as ConcreteType<number> === U32Type;
    const isI32Type = options.binaryOp.type as unknown as ConcreteType<number> === I32Type;

    if (
      options.allowAtomicShader &&
      options.binaryOp.atomicName &&
      ( isU32Type || isI32Type )
    ) {
      const atomicType = ( isU32Type ? U32AtomicType : I32AtomicType ) as unknown as ConcreteType<T>;
      const module = new MainReduceAtomicModule( combineOptions<MainReduceAtomicModuleOptions<T>>( {
        name: `${options.name} atomic`,
        log: options.log,
        input: options.input,
        output: options.output.castTo( atomicType ),
        binaryOp: options.binaryOp,
        workgroupSize: options.workgroupSize,
        grainSize: options.grainSize,
        loadReducedOptions: {
          lengthExpression: options.lengthExpression,
          inputOrder: options.inputOrder,
          inputAccessOrder: options.inputAccessOrder
        },
        reduceOptions: {
          convergent: options.binaryOp.isCommutative
        }
      }, options.mainReduceAtomicModuleOptions ) );
      modules = [ module ];

      execute = ( context, inputSize: number ) => {
        module.execute( context, inputSize );
      };

      slots = [ options.input, options.output ];
      internalSlots = [];
    }
    else {
      const perStageReduction = options.workgroupSize * options.grainSize;
      const initialStageInputSize = options.input.length;
      const numStages = Math.ceil( Math.log2( initialStageInputSize ) / Math.log2( perStageReduction ) );
      assert && assert( numStages > 0, 'Do not pass in a single-element input' );

      // TODO: detect the atomic case(!)

      // TODO: should we "stripe" the next layer of data?

      internalSlots = _.range( 0, numStages - 1 ).map( i => {
        return new BufferArraySlot( getArrayType( options.binaryOp.type, Math.ceil( initialStageInputSize / ( perStageReduction ** ( i + 1 ) ) ), options.binaryOp.identity ) );
      } );

      slots = [
        options.input,
        ...internalSlots,
        options.output
      ];

      modules = _.range( 0, numStages ).map( i => {
        const commonOptions = {
          name: `${options.name} ${i}`,
          log: options.log,
          input: slots[ i ],
          output: slots[ i + 1 ],
          binaryOp: options.binaryOp,
          workgroupSize: options.workgroupSize,
          grainSize: options.grainSize
        } as const;

        if (
          options.allowNonCommutativeShader &&
          options.inputOrder === 'blocked' &&
          options.inputAccessOrder === 'striped' &&
          !options.binaryOp.isCommutative
        ) {
          assert && assert( !options.lengthExpression, 'Not yet supported' ); // TODO: handle length(!)

          return new MainReduceNonCommutativeModule( combineOptions<MainReduceNonCommutativeModuleOptions<T>>( {
            // anything in the future?
          }, commonOptions, options.mainReduceNonCommutativeModuleOptions ) );
        }
        else {
          return new MainReduceModule( combineOptions<MainReduceModuleOptions<T>>( {
            loadReducedOptions: {
              lengthExpression: ceilDivideConstantDivisorWGSL( options.lengthExpression, perStageReduction ** i ),
              inputOrder: options.inputOrder,
              inputAccessOrder: options.inputAccessOrder
            },
            reduceOptions: {
              convergent: options.binaryOp.isCommutative
            }
          }, commonOptions, options.mainReduceModuleOptions ) );
        }
      } );

      execute = ( context, inputSize: number ) => {
        let stageInputSize = inputSize;

        for ( let i = 0; i < modules.length; i++ ) {
          modules[ i ].execute( context, stageInputSize );
          stageInputSize = Math.ceil( stageInputSize / perStageReduction );
        }
      };
    }

    super( modules, execute );

    this.input = providedOptions.input;
    this.output = providedOptions.output;
    this.slots = slots;
    this.internalSlots = internalSlots;
  }
}
alpenglow.register( 'ReduceModule', ReduceModule );
