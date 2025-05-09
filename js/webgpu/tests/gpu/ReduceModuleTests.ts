// Copyright 2023-2025, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { combineOptions } from '../../../../../phet-core/js/optionize.js';
import StrictOmit from '../../../../../phet-core/js/types/StrictOmit.js';
import { ReduceModule, ReduceModuleOptions } from '../../modules/gpu/ReduceModule.js';
import { asyncTestWithDevice, compareArrays } from '../ShaderTestUtils.js';
import { BufferArraySlot } from '../../compute/BufferArraySlot.js';
import { getArrayType, I32Add, U32Add, Vec2uAdd, Vec2uBic } from '../../compute/ConcreteType.js';
import { u32S } from '../../wgsl/WGSLString.js';
import { Routine } from '../../compute/Routine.js';
import { Procedure } from '../../compute/Procedure.js';

QUnit.module( 'ReduceModuleTests' );

type ReduceModuleTestOptions<T> = {
  name: string;
  inputSize: number;
  maximumSize: number;
} & StrictOmit<ReduceModuleOptions<T>, 'input' | 'output' | 'lengthExpression'>;

const testReduceModule = <T>( options: ReduceModuleTestOptions<T> ) => {
  asyncTestWithDevice( options.name, async ( device, deviceContext ) => {

    const inputSlot = new BufferArraySlot( getArrayType( options.binaryOp.type, options.maximumSize, options.binaryOp.identity ) );
    const outputSlot = new BufferArraySlot( getArrayType( options.binaryOp.type, 1, options.binaryOp.identity ) ); // TODO

    // TODO: inspect all usages of everything, look for simplification opportunities

    const reduceModule = new ReduceModule( combineOptions<ReduceModuleOptions<T>>( {
      input: inputSlot,
      output: outputSlot,
      lengthExpression: u32S( options.inputSize )
    }, options ) );

    const routine = await Routine.create(
      deviceContext,
      reduceModule,
      [ inputSlot, outputSlot ],
      Routine.INDIVIDUAL_LAYOUT_STRATEGY,
      ( context, execute, input: T[] ) => {
        context.setTypedBufferValue( inputSlot, input );

        execute( context, input.length );

        return context.getTypedBufferValue( outputSlot );
      }
    );

    const procedure = new Procedure( routine ).bindRemainingBuffers();

    const inputValues = _.range( 0, options.inputSize ).map( () => options.binaryOp.type.generateRandom( false ) );
    const expectedValues = [ inputValues.reduce( ( a, b ) => options.binaryOp.apply( a, b ), options.binaryOp.identity ) ];
    const actualValues = await procedure.standaloneExecute( deviceContext, inputValues );

    procedure.dispose();

    return compareArrays( options.binaryOp.type, inputValues, expectedValues, actualValues );
  } );
};

// single-level
{
  const workgroupSize = 256;
  const grainSize = 8;

  const options = {
    inputSize: workgroupSize * grainSize - 27,
    maximumSize: workgroupSize * grainSize,
    workgroupSize: workgroupSize,
    grainSize: grainSize
  } as const;

  testReduceModule( {
    // eslint-disable-next-line phet/no-object-spread-on-non-literals
    ...options,
    name: 'u32 add reduce (atomic) single-size',
    binaryOp: U32Add
  } );

  testReduceModule( {
    // eslint-disable-next-line phet/no-object-spread-on-non-literals
    ...options,
    name: 'i32 add reduce (atomic) single-size',
    binaryOp: I32Add
  } );

  testReduceModule( {
    // eslint-disable-next-line phet/no-object-spread-on-non-literals
    ...options,
    name: 'vec2u add reduce (multi-layer commutative) single-size',
    binaryOp: Vec2uAdd
  } );

  testReduceModule( {
    // eslint-disable-next-line phet/no-object-spread-on-non-literals
    ...options,
    name: 'bicyclic semigroup reduce (multi-layer non-commutative) single-size',
    binaryOp: Vec2uBic
  } );
}

// double-level
{
  const workgroupSize = 256;
  const grainSize = 8;

  const options = {
    inputSize: workgroupSize * grainSize * 5 - 27,
    maximumSize: workgroupSize * grainSize * 10,
    workgroupSize: workgroupSize,
    grainSize: grainSize
  } as const;

  testReduceModule( {
    // eslint-disable-next-line phet/no-object-spread-on-non-literals
    ...options,
    name: 'u32 add reduce (atomic) double-size',
    binaryOp: U32Add
  } );

  testReduceModule( {
    // eslint-disable-next-line phet/no-object-spread-on-non-literals
    ...options,
    name: 'i32 add reduce (atomic) double-size',
    binaryOp: I32Add
  } );

  testReduceModule( {
    // eslint-disable-next-line phet/no-object-spread-on-non-literals
    ...options,
    name: 'vec2u add reduce (multi-layer commutative) double-size',
    binaryOp: Vec2uAdd
  } );

  testReduceModule( {
    // eslint-disable-next-line phet/no-object-spread-on-non-literals
    ...options,
    name: 'bicyclic semigroup reduce (multi-layer non-commutative) double-size',
    binaryOp: Vec2uBic
  } );
}

// triple-level
{
  const workgroupSize = 32;
  const grainSize = 2;

  const options = {
    inputSize: Math.ceil( ( workgroupSize * grainSize ) ** 2.1 ),
    maximumSize: Math.ceil( ( workgroupSize * grainSize ) ** 2.2 ),
    workgroupSize: workgroupSize,
    grainSize: grainSize
  } as const;

  testReduceModule( {
    // eslint-disable-next-line phet/no-object-spread-on-non-literals
    ...options,
    name: 'u32 add reduce (atomic) triple-size',
    binaryOp: U32Add
  } );

  testReduceModule( {
    // eslint-disable-next-line phet/no-object-spread-on-non-literals
    ...options,
    name: 'i32 add reduce (atomic) triple-size',
    binaryOp: I32Add
  } );

  testReduceModule( {
    // eslint-disable-next-line phet/no-object-spread-on-non-literals
    ...options,
    name: 'vec2u add reduce (multi-layer commutative) triple-size',
    binaryOp: Vec2uAdd
  } );

  testReduceModule( {
    // eslint-disable-next-line phet/no-object-spread-on-non-literals
    ...options,
    name: 'bicyclic semigroup reduce (multi-layer non-commutative) triple-size',
    binaryOp: Vec2uBic
  } );
}

{
  testReduceModule( {
    name: 'logging test: vec2 add reduce (multi-layer commutative) double-size',
    binaryOp: Vec2uAdd,
    log: true,
    inputSize: 702,
    maximumSize: 1024,
    workgroupSize: 256,
    grainSize: 2
  } );
}