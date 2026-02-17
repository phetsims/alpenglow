// Copyright 2024-2025, University of Colorado Boulder

/**
 * A single level of standalone reduction.
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import { combineOptions, optionize3 } from '../../../../../phet-core/js/optionize.js';
import IntentionalAny from '../../../../../phet-core/js/types/IntentionalAny.js';
import { alpenglow } from '../../../alpenglow.js';
import { BufferArraySlot } from '../../compute/BufferArraySlot.js';
import { BinaryOp, getArrayType } from '../../compute/ConcreteType.js';
import type { WGSLExpressionU32 } from '../../wgsl/WGSLString.js';
import { MainScanModule, MainScanModuleOptions } from './MainScanModule.js';
import { MainReduceModule, MainReduceModuleOptions } from './MainReduceModule.js';
import { MainReduceNonCommutativeModule, MainReduceNonCommutativeModuleOptions } from './MainReduceNonCommutativeModule.js';
import type { PipelineBlueprintOptions } from '../../compute/PipelineBlueprint.js';
import { CompositeModule } from '../../compute/CompositeModule.js';
import { Module } from '../../compute/Module.js';
import { ExecutionContext } from '../../compute/ExecutionContext.js';
import { ceilDivideConstantDivisorWGSL } from '../../wgsl/gpu/ceilDivideConstantDivisorWGSL.js';

type SelfOptions<T> = {
  // NOTE: Can be in-place of input and output point to the same slot
  input: BufferArraySlot<T>;
  output: BufferArraySlot<T>;

  binaryOp: BinaryOp<T>;
  exclusive: boolean;

  workgroupSize: number;
  grainSize: number;
  lengthExpression: WGSLExpressionU32;

  // TODO: instead of these, get fusable data operators
  inputOrder?: 'blocked' | 'striped';
  inputAccessOrder?: 'blocked' | 'striped';

  // TODO: marked as potentially broken?
  internalStriping?: boolean;

  // Whether our internal "reduces" data will be exclusive or inclusive (both are possible)
  areScannedReductionsExclusive?: boolean;
};

type ParentOptions<T> = {
  mainScanModuleOptions?: Partial<MainScanModuleOptions<T>>;
  mainReduceModuleOptions?: Partial<MainReduceModuleOptions<T>>;
  mainReduceNonCommutativeModuleOptions?: Partial<MainReduceNonCommutativeModuleOptions<T>>;
} & PipelineBlueprintOptions;

export type ScanModuleOptions<T> = SelfOptions<T> & ParentOptions<T>;

export const SCAN_MODULE_DEFAULTS = {
  name: 'scan',
  log: false, // TODO: how to deduplicate this? - We don't really need all of the defaults, right?
  inputOrder: 'blocked',
  inputAccessOrder: 'striped',
  internalStriping: false,
  areScannedReductionsExclusive: false,
  mainScanModuleOptions: {},
  mainReduceModuleOptions: {},
  mainReduceNonCommutativeModuleOptions: {}
} as const;

// stageInputSize: number
export class ScanModule<T> extends CompositeModule<number> {

  public readonly input: BufferArraySlot<T>;
  public readonly output: BufferArraySlot<T>;
  public readonly slots: BufferArraySlot<T>[];
  public readonly internalSlots: BufferArraySlot<T>[];

  public constructor(
    providedOptions: ScanModuleOptions<T>
  ) {
    const options = optionize3<ScanModuleOptions<T>, SelfOptions<T>>()( {}, SCAN_MODULE_DEFAULTS, providedOptions );

    const perStageReduction = options.workgroupSize * options.grainSize;
    const initialStageInputSize = options.input.length;
    const numStages = Math.ceil( Math.log2( initialStageInputSize ) / Math.log2( perStageReduction ) );
    assert && assert( numStages > 0, 'Do not pass in a single-element input' );

    let modules: Module<IntentionalAny>[];
    let execute: ( context: ExecutionContext, inputSize: number ) => void;
    let slots: BufferArraySlot<T>[];
    let internalSlots: BufferArraySlot<T>[];

    const inPlace = options.input === options.output;

    if ( numStages === 1 ) {
      const module = new MainScanModule( combineOptions<MainScanModuleOptions<T>>( {
        name: `${options.name} 0`,
        log: options.log,
        binaryOp: options.binaryOp,
        workgroupSize: options.workgroupSize,
        grainSize: options.grainSize,
        lengthExpression: options.lengthExpression,
        exclusive: options.exclusive,
        inputOrder: options.inputOrder,
        inputAccessOrder: options.inputAccessOrder
      }, inPlace ? {
        inPlace: true,
        data: options.input
      } : {
        inPlace: false,
        input: options.input,
        output: options.output
      }, options.mainScanModuleOptions ) );
      modules = [ module ];

      execute = ( context, inputSize: number ) => {
        module.execute( context, inputSize );
      };

      slots = _.uniq( [ options.input, options.output ] );
      internalSlots = [];
    }
    else if ( numStages === 2 ) {

      const reductionSlot = new BufferArraySlot( getArrayType( options.input.concreteArrayType.elementType, Math.ceil( initialStageInputSize / perStageReduction ) ) );

      const reduceOptions = {
        name: `${options.name} reduce`,
        log: options.log,
        input: options.input,
        output: reductionSlot,
        binaryOp: options.binaryOp,
        workgroupSize: options.workgroupSize,
        grainSize: options.grainSize
      };
      const reduceModule = ( options.inputOrder === 'blocked' && options.inputAccessOrder === 'striped' && !options.binaryOp.isCommutative ) ? new MainReduceNonCommutativeModule( combineOptions<MainReduceNonCommutativeModuleOptions<T>>( {
        lengthExpression: options.lengthExpression
      }, reduceOptions, options.mainReduceNonCommutativeModuleOptions ) ) : new MainReduceModule( combineOptions<MainReduceModuleOptions<T>>( {
        loadReducedOptions: {
          lengthExpression: options.lengthExpression,
          inputOrder: options.inputOrder,
          inputAccessOrder: options.inputAccessOrder
        },
        reduceOptions: {
          convergent: options.binaryOp.isCommutative
        },
        stripeOutput: options.internalStriping
      }, reduceOptions, options.mainReduceModuleOptions ) );

      const lowerScanModule = new MainScanModule( combineOptions<MainScanModuleOptions<T>>( {
        name: `${options.name} lower scan`,
        log: options.log,
        binaryOp: options.binaryOp,
        workgroupSize: options.workgroupSize,
        grainSize: options.grainSize,
        lengthExpression: options.lengthExpression ? ceilDivideConstantDivisorWGSL( options.lengthExpression, perStageReduction ) : null,
        inputOrder: options.internalStriping ? 'striped' : 'blocked',
        inputAccessOrder: options.inputAccessOrder,
        exclusive: options.areScannedReductionsExclusive,
        inPlace: true,
        data: reductionSlot
      }, options.mainScanModuleOptions ) );

      const upperScanModule = new MainScanModule( combineOptions<MainScanModuleOptions<T>>( {
        name: `${options.name} upper scan`,
        log: options.log,
        binaryOp: options.binaryOp,
        workgroupSize: options.workgroupSize,
        grainSize: options.grainSize,
        lengthExpression: options.lengthExpression,
        inputOrder: options.inputOrder,
        inputAccessOrder: options.inputAccessOrder,
        exclusive: options.exclusive,
        areScannedReductionsExclusive: options.areScannedReductionsExclusive,
        addScannedReduction: true,
        scannedReduction: reductionSlot
      }, inPlace ? {
        inPlace: true,
        data: options.input
      } : {
        inPlace: false,
        input: options.input,
        output: options.output
      }, options.mainScanModuleOptions ) );

      modules = [ reduceModule, lowerScanModule, upperScanModule ];

      execute = ( context, inputSize: number ) => {
        reduceModule.execute( context, inputSize );
        lowerScanModule.execute( context, Math.ceil( inputSize / perStageReduction ) );
        upperScanModule.execute( context, inputSize );
      };

      slots = _.uniq( [ options.input, options.output, reductionSlot ] );
      internalSlots = [ reductionSlot ];
    }
    else if ( numStages === 3 ) {

      const reductionSlot = new BufferArraySlot( getArrayType( options.input.concreteArrayType.elementType, Math.ceil( initialStageInputSize / perStageReduction ) ) );
      const doubleReductionSlot = new BufferArraySlot( getArrayType( options.input.concreteArrayType.elementType, Math.ceil( initialStageInputSize / ( perStageReduction * perStageReduction ) ) ) );

      const reduceOptions = {
        name: `${options.name} reduce`,
        log: options.log,
        input: options.input,
        output: reductionSlot,
        binaryOp: options.binaryOp,
        workgroupSize: options.workgroupSize,
        grainSize: options.grainSize
      };
      const reduceModule = ( options.inputOrder === 'blocked' && options.inputAccessOrder === 'striped' && !options.binaryOp.isCommutative ) ? new MainReduceNonCommutativeModule( combineOptions<MainReduceNonCommutativeModuleOptions<T>>( {
        lengthExpression: options.lengthExpression
      }, reduceOptions, options.mainReduceNonCommutativeModuleOptions ) ) : new MainReduceModule( combineOptions<MainReduceModuleOptions<T>>( {
        loadReducedOptions: {
          lengthExpression: options.lengthExpression,
          inputOrder: options.inputOrder,
          inputAccessOrder: options.inputAccessOrder
        },
        reduceOptions: {
          convergent: options.binaryOp.isCommutative
        },
        stripeOutput: options.internalStriping
      }, reduceOptions, options.mainReduceModuleOptions ) );

      const middleScanModule = new MainScanModule( combineOptions<MainScanModuleOptions<T>>( {
        name: `${options.name} middle scan`,
        log: options.log,
        binaryOp: options.binaryOp,
        workgroupSize: options.workgroupSize,
        grainSize: options.grainSize,
        lengthExpression: options.lengthExpression ? ceilDivideConstantDivisorWGSL( options.lengthExpression, perStageReduction ) : null,
        inputOrder: options.internalStriping ? 'striped' : 'blocked',
        inputAccessOrder: options.inputAccessOrder,
        exclusive: options.areScannedReductionsExclusive,
        inPlace: true,
        data: reductionSlot,
        storeReduction: true,
        reduction: doubleReductionSlot,
        stripeReducedOutput: options.internalStriping
      }, options.mainScanModuleOptions ) );

      const lowerScanModule = new MainScanModule( combineOptions<MainScanModuleOptions<T>>( {
        name: `${options.name} lower scan`,
        log: options.log,
        binaryOp: options.binaryOp,
        workgroupSize: options.workgroupSize,
        grainSize: options.grainSize,
        lengthExpression: options.lengthExpression ? ceilDivideConstantDivisorWGSL( options.lengthExpression, perStageReduction * perStageReduction ) : null,
        inputOrder: options.internalStriping ? 'striped' : 'blocked',
        inputAccessOrder: options.inputAccessOrder,
        exclusive: options.areScannedReductionsExclusive,
        inPlace: true,
        data: doubleReductionSlot,
        stripeReducedOutput: options.internalStriping
      }, options.mainScanModuleOptions ) );

      const upperScanModule = new MainScanModule( combineOptions<MainScanModuleOptions<T>>( {
        name: `${options.name} upper scan`,
        log: options.log,
        binaryOp: options.binaryOp,
        workgroupSize: options.workgroupSize,
        grainSize: options.grainSize,
        lengthExpression: options.lengthExpression,
        inputOrder: options.inputOrder,
        inputAccessOrder: options.inputAccessOrder,
        exclusive: options.exclusive,
        areScannedReductionsExclusive: options.areScannedReductionsExclusive,
        addScannedReduction: true,
        scannedReduction: reductionSlot,
        addScannedDoubleReduction: true,
        scannedDoubleReduction: doubleReductionSlot
      }, inPlace ? {
        inPlace: true,
        data: options.input
      } : {
        inPlace: false,
        input: options.input,
        output: options.output
      }, options.mainScanModuleOptions ) );

      modules = [ reduceModule, middleScanModule, lowerScanModule, upperScanModule ];

      execute = ( context, inputSize: number ) => {

        // context.u32Numbers( options.input ).then( histogram => console.log( `histogram`, histogram ) ).catch( e => { throw e; } );

        reduceModule.execute( context, inputSize );

        // context.u32Numbers( reductionSlot ).then( histogram => console.log( `reduction`, histogram ) ).catch( e => { throw e; } );

        middleScanModule.execute( context, Math.ceil( inputSize / perStageReduction ) );

        // context.u32Numbers( reductionSlot ).then( histogram => console.log( `reduction (scanned)`, histogram ) ).catch( e => { throw e; } );
        // context.u32Numbers( doubleReductionSlot ).then( histogram => console.log( `double reduction`, histogram ) ).catch( e => { throw e; } );

        lowerScanModule.execute( context, Math.ceil( inputSize / ( perStageReduction * perStageReduction ) ) );

        // context.u32Numbers( doubleReductionSlot ).then( histogram => console.log( `double reduction (scanned)`, histogram ) ).catch( e => { throw e; } );

        upperScanModule.execute( context, inputSize );

        // context.u32Numbers( options.output ).then( histogram => console.log( `scanned histogram`, histogram ) ).catch( e => { throw e; } );
      };

      slots = _.uniq( [ options.input, options.output, reductionSlot, doubleReductionSlot ] );
      internalSlots = [ reductionSlot, doubleReductionSlot ];
    }
    else {
      throw new Error( `invalid number of stages: ${numStages}` );
    }

    super( modules, execute );

    this.input = providedOptions.input;
    this.output = providedOptions.output;
    this.slots = slots;
    this.internalSlots = internalSlots;
  }
}
alpenglow.register( 'ScanModule', ScanModule );