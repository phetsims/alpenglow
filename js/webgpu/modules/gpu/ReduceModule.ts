// Copyright 2023-2024, University of Colorado Boulder

/**
 * A full reduction, with the method of reduction chosen based on the type and configuration.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BinaryOp, BufferArraySlot, ceilDivideConstantDivisorWGSL, CompositeModule, ConcreteType, ExecutionContext, getArrayType, I32AtomicType, I32Type, MainReduceAtomicModule, MainReduceAtomicModuleOptions, MainReduceModule, MainReduceModuleOptions, MainReduceNonCommutativeModule, MainReduceNonCommutativeModuleOptions, Module, PipelineBlueprint, PipelineBlueprintOptions, U32AtomicType, U32Type, WGSLExpressionU32 } from '../../../imports.js';
import { combineOptions, optionize3 } from '../../../../../phet-core/js/optionize.js';
import IntentionalAny from '../../../../../phet-core/js/types/IntentionalAny.js';

type SelfOptions<T> = {
  input: BufferArraySlot<T>;
  output: BufferArraySlot<T>;
  binaryOp: BinaryOp<T>;

  workgroupSize: number;
  grainSize: number;
  lengthExpression: ( pipeline: PipelineBlueprint ) => WGSLExpressionU32;

  // TODO: instead of these, get fusable data operators
  inputOrder?: 'blocked' | 'striped';
  inputAccessOrder?: 'blocked' | 'striped';

  allowAtomicShader?: boolean;
  allowNonCommutativeShader?: boolean;
};

type ParentOptions<T> = {
  mainReduceModuleOptions?: Partial<MainReduceModuleOptions<T>>;
  mainReduceNonCommutativeModuleOptions?: Partial<MainReduceNonCommutativeModuleOptions<T>>;
  mainReduceAtomicModuleOptions?: Partial<MainReduceAtomicModuleOptions<T>>;
} & PipelineBlueprintOptions;

export type ReduceModuleOptions<T> = SelfOptions<T> & ParentOptions<T>;

export const REDUCE_MODULE_DEFAULTS = {
  inputOrder: 'blocked',
  inputAccessOrder: 'striped',
  allowAtomicShader: true,
  allowNonCommutativeShader: true,
  mainReduceModuleOptions: {},
  mainReduceNonCommutativeModuleOptions: {},
  mainReduceAtomicModuleOptions: {}
} as const;

// inputSize: number
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
      ( isU32Type || isI32Type ) &&
      numStages > 1 // no point to doing atomics if we only have one stage
    ) {

      // TODO: we should set the atomic type to the initial value (identity), no? Especially if we are reusing buffers

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
          return new MainReduceNonCommutativeModule( combineOptions<MainReduceNonCommutativeModuleOptions<T>>( {
            lengthExpression: options.lengthExpression
          }, commonOptions, options.mainReduceNonCommutativeModuleOptions ) );
        }
        else {
          return new MainReduceModule( combineOptions<MainReduceModuleOptions<T>>( {
            loadReducedOptions: {
              lengthExpression: blueprint => ceilDivideConstantDivisorWGSL( options.lengthExpression( blueprint ), perStageReduction ** i ),
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
