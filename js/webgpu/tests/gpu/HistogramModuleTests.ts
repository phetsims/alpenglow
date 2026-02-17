// Copyright 2024-2025, University of Colorado Boulder

/**
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import Vector2 from '../../../../../dot/js/Vector2.js';
import { combineOptions } from '../../../../../phet-core/js/optionize.js';
import StrictOmit from '../../../../../phet-core/js/types/StrictOmit.js';
import { ConcreteType, getArrayType, U32AtomicType, U32Type, Vec2uType } from '../../compute/ConcreteType.js';
import { HistogramModule, HistogramModuleOptions } from '../../modules/gpu/HistogramModule.js';
import { asyncTestWithDevice, compareArrays } from '../ShaderTestUtils.js';
import { BufferArraySlot } from '../../compute/BufferArraySlot.js';
import { u32S, wgsl } from '../../wgsl/WGSLString.js';
import { Routine } from '../../compute/Routine.js';
import { Procedure } from '../../compute/Procedure.js';

QUnit.module( 'HistogramModuleTests' );

type HistogramModuleTestOptions<T> = {
  name: string;
  type: ConcreteType<T>;
  getBinTS: ( value: T ) => number;
  inputSize: number;
} & StrictOmit<HistogramModuleOptions<T>, 'input' | 'output' | 'lengthExpression'>;

const testHistogramModule = <T>( options: HistogramModuleTestOptions<T> ) => {
  asyncTestWithDevice( options.name, async ( device, deviceContext ) => {

    const inputSlot = new BufferArraySlot( getArrayType( options.type, options.inputSize ) );
    const outputSlot = new BufferArraySlot( getArrayType( U32AtomicType, options.numBins ) );

    const module = new HistogramModule( combineOptions<HistogramModuleOptions<T>>( {
      input: inputSlot,
      output: outputSlot,
      lengthExpression: u32S( options.inputSize )
    }, options ) );

    const routine = await Routine.create(
      deviceContext,
      module,
      [ inputSlot, outputSlot ],
      Routine.INDIVIDUAL_LAYOUT_STRATEGY,
      ( context, execute, input: T[] ) => {
        context.setTypedBufferValue( inputSlot, input );

        execute( context, input.length );

        return context.getTypedBufferValue( outputSlot );
      }
    );

    const procedure = new Procedure( routine ).bindRemainingBuffers();

    const inputValues = _.range( 0, options.inputSize ).map( () => options.type.generateRandom( true ) );
    const expectedValues = _.range( 0, options.numBins ).map( bin => {
      return inputValues.filter( value => options.getBinTS( value ) === bin ).length;
    } );
    const actualValues = await procedure.standaloneExecute( deviceContext, inputValues );

    procedure.dispose();

    return compareArrays( U32AtomicType, inputValues, expectedValues, actualValues );
  } );
};

{
  const options = {
    workgroupSize: 64,
    grainSize: 8,
    inputSize: 2000
  } as const;

  testHistogramModule<number>( {
    // eslint-disable-next-line phet/no-object-spread-on-non-literals
    ...options,
    name: 'u32 histogram mod 256',
    numBins: 256,
    type: U32Type,
    getBinTS: value => value % 256,
    getBin: value => wgsl`( ${value} % 256u )`
  } );

  testHistogramModule<Vector2>( {
    // eslint-disable-next-line phet/no-object-spread-on-non-literals
    ...options,
    name: 'vec2u histogram custom',
    numBins: 256,
    type: Vec2uType,
    getBinTS: value => ( ( value.x % 10203 ) + ( value.y % 1234 ) ) % 256,
    getBin: value => wgsl`( ( ( ${value}.x % 10203u ) + ( ${value}.y % 1234u ) ) % 256u )`
  } );
}