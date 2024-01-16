// Copyright 2024, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { asyncTestWithDevice, BufferArraySlot, compareArrays, ConcreteType, getArrayType, HistogramModule, HistogramModuleOptions, Procedure, Routine, u32, U32AtomicType, U32Type } from '../../../imports.js';
import { combineOptions } from '../../../../../phet-core/js/optionize.js';
import StrictOmit from '../../../../../phet-core/js/types/StrictOmit.js';

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
      lengthExpression: u32( options.inputSize )
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
  const workgroupSize = 64;
  const grainSize = 8;

  const options = {
    workgroupSize: workgroupSize,
    grainSize: grainSize
  } as const;

  testHistogramModule<number>( {
    // eslint-disable-next-line no-object-spread-on-non-literals
    ...options,
    name: 'u32 histogram mod 256',
    numBins: 256,
    type: U32Type,
    inputSize: 10000,
    getBinTS: value => value % 256,
    getBin: value => `( ${value} % 256u )`
  } );
}
