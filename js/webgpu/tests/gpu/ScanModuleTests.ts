// Copyright 2024-2025, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { combineOptions } from '../../../../../phet-core/js/optionize.js';
import StrictOmit from '../../../../../phet-core/js/types/StrictOmit.js';
import { ScanModule, ScanModuleOptions } from '../../modules/gpu/ScanModule.js';
import { asyncTestWithDevice, compareArrays } from '../ShaderTestUtils.js';
import { BufferArraySlot } from '../../compute/BufferArraySlot.js';
import { getArrayType, I32Add, U32Add, Vec2uAdd, Vec2uBic } from '../../compute/ConcreteType.js';
import { u32S } from '../../wgsl/WGSLString.js';
import { Routine } from '../../compute/Routine.js';
import { Procedure } from '../../compute/Procedure.js';

QUnit.module( 'ScanModuleTests' );

type ScanModuleTestOptions<T> = {
  name: string;
  inputSize: number;
  maximumSize: number;
  inPlace?: boolean;
} & StrictOmit<ScanModuleOptions<T>, 'input' | 'output' | 'lengthExpression'>;

const testScanModule = <T>( options: ScanModuleTestOptions<T> ) => {
  asyncTestWithDevice( options.name, async ( device, deviceContext ) => {

    const inputSlot = new BufferArraySlot( getArrayType( options.binaryOp.type, options.maximumSize, options.binaryOp.identity ) );
    const outputSlot = options.inPlace ? inputSlot : new BufferArraySlot( getArrayType( options.binaryOp.type, options.maximumSize, options.binaryOp.identity ) );

    const reduceModule = new ScanModule( combineOptions<ScanModuleOptions<T>>( {
      input: inputSlot,
      output: outputSlot,
      lengthExpression: u32S( options.inputSize )
    }, options ) );

    // TODO: can we factor out some things here, like the execute wrapper?
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

    const expectedValues: T[] = [];
    let value = options.binaryOp.identity;
    for ( let i = 0; i < options.inputSize; i++ ) {
      options.exclusive && expectedValues.push( value );

      value = options.binaryOp.apply( value, inputValues[ i ] );

      !options.exclusive && expectedValues.push( value );
    }

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

  [ false, true ].forEach( inPlace => {
    [ false, true ].forEach( exclusive => {
      const commonString = `scan single-size ${exclusive ? 'exclusive' : 'inclusive'}${inPlace ? ' in-place' : ''}`;

      testScanModule( {
        // eslint-disable-next-line phet/no-object-spread-on-non-literals
        ...options,
        name: `u32 add ${commonString}`,
        binaryOp: U32Add,
        exclusive: false,
        inPlace: inPlace
      } );

      testScanModule( {
        // eslint-disable-next-line phet/no-object-spread-on-non-literals
        ...options,
        name: `i32 add ${commonString}`,
        binaryOp: I32Add,
        exclusive: false,
        inPlace: inPlace
      } );

      testScanModule( {
        // eslint-disable-next-line phet/no-object-spread-on-non-literals
        ...options,
        name: `vec2u add ${commonString}`,
        binaryOp: Vec2uAdd,
        exclusive: false,
        inPlace: inPlace
      } );

      testScanModule( {
        // eslint-disable-next-line phet/no-object-spread-on-non-literals
        ...options,
        name: `bicyclic semigroup add ${commonString}`,
        binaryOp: Vec2uBic,
        exclusive: false,
        inPlace: inPlace
      } );
    } );
  } );
}

// double-level
{
  const workgroupSize = 256;
  const grainSize = 4;
  // NOTE: we're using a lot of workgroup size here(!)

  const options = {
    inputSize: workgroupSize * grainSize * 5 - 27,
    maximumSize: workgroupSize * grainSize * 10,
    workgroupSize: workgroupSize,
    grainSize: grainSize
  } as const;

  [ false, true ].forEach( inPlace => {
    [ false, true ].forEach( exclusive => {
      const commonString = `scan double-size ${exclusive ? 'exclusive' : 'inclusive'}${inPlace ? ' in-place' : ''}`;

      testScanModule( {
        // eslint-disable-next-line phet/no-object-spread-on-non-literals
        ...options,
        name: `u32 add ${commonString}`,
        binaryOp: U32Add,
        exclusive: false,
        inPlace: inPlace
      } );

      testScanModule( {
        // eslint-disable-next-line phet/no-object-spread-on-non-literals
        ...options,
        name: `i32 add ${commonString}`,
        binaryOp: I32Add,
        exclusive: false,
        inPlace: inPlace
      } );

      testScanModule( {
        // eslint-disable-next-line phet/no-object-spread-on-non-literals
        ...options,
        name: `vec2u add ${commonString}`,
        binaryOp: Vec2uAdd,
        exclusive: false,
        inPlace: inPlace
      } );

      testScanModule( {
        // eslint-disable-next-line phet/no-object-spread-on-non-literals
        ...options,
        name: `bicyclic semigroup add ${commonString}`,
        binaryOp: Vec2uBic,
        exclusive: false,
        inPlace: inPlace
      } );
    } );
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

  [ false, true ].forEach( inPlace => {
    [ false, true ].forEach( exclusive => {
      const commonString = `scan triple-size ${exclusive ? 'exclusive' : 'inclusive'}${inPlace ? ' in-place' : ''}`;

      testScanModule( {
        // eslint-disable-next-line phet/no-object-spread-on-non-literals
        ...options,
        name: `u32 add ${commonString}`,
        binaryOp: U32Add,
        exclusive: false,
        inPlace: inPlace
      } );

      testScanModule( {
        // eslint-disable-next-line phet/no-object-spread-on-non-literals
        ...options,
        name: `i32 add ${commonString}`,
        binaryOp: I32Add,
        exclusive: false,
        inPlace: inPlace
      } );

      testScanModule( {
        // eslint-disable-next-line phet/no-object-spread-on-non-literals
        ...options,
        name: `vec2u add ${commonString}`,
        binaryOp: Vec2uAdd,
        exclusive: false,
        inPlace: inPlace
      } );

      testScanModule( {
        // eslint-disable-next-line phet/no-object-spread-on-non-literals
        ...options,
        name: `bicyclic semigroup add ${commonString}`,
        binaryOp: Vec2uBic,
        exclusive: false,
        inPlace: inPlace
      } );
    } );
  } );
}

// TODO: add tests for other performance features? (maybe after we test?)