// Copyright 2024, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { asyncTestWithDevice, BufferArraySlot, compareArrays, getArrayType, I32Order, MergeSimpleModule, MergeSimpleModuleOptions, Procedure, Routine, U32Order, U32ReverseOrder, u32S, Vec2uLexicographicalOrder } from '../../../imports.js';
import { combineOptions } from '../../../../../phet-core/js/optionize.js';
import StrictOmit from '../../../../../phet-core/js/types/StrictOmit.js';

QUnit.module( 'MergeSimpleModuleTests' );

type MergeSimpleModuleTestOptions<T> = {
  name: string;
  inputASize: number;
  inputBSize: number;
} & StrictOmit<MergeSimpleModuleOptions<T>, 'inputA' | 'inputB' | 'output' | 'lengthExpressionA' | 'lengthExpressionB'>;

const testMergeSimpleModule = <T>( options: MergeSimpleModuleTestOptions<T> ) => {
  asyncTestWithDevice( options.name, async ( device, deviceContext ) => {

    const inputASlot = new BufferArraySlot( getArrayType( options.order.type, options.inputASize, options.order.type.outOfRangeElement ) );
    const inputBSlot = new BufferArraySlot( getArrayType( options.order.type, options.inputBSize, options.order.type.outOfRangeElement ) );
    const outputSlot = new BufferArraySlot( getArrayType( options.order.type, options.inputASize + options.inputBSize, options.order.type.outOfRangeElement ) );

    // TODO: inspect all usages of everything, look for simplification opportunities

    const module = new MergeSimpleModule( combineOptions<MergeSimpleModuleOptions<T>>( {
      inputA: inputASlot,
      inputB: inputBSlot,
      output: outputSlot,
      lengthExpressionA: u32S( options.inputASize ),
      lengthExpressionB: u32S( options.inputBSize )
    }, options ) );

    const routine = await Routine.create(
      deviceContext,
      module,
      [ inputASlot, inputBSlot, outputSlot ],
      Routine.INDIVIDUAL_LAYOUT_STRATEGY,
      ( context, execute, input: { a: T[]; b: T[] } ) => {
        context.setTypedBufferValue( inputASlot, input.a );
        context.setTypedBufferValue( inputBSlot, input.b );

        execute( context, input.a.length + input.b.length );

        return context.getTypedBufferValue( outputSlot );
      }
    );

    const procedure = new Procedure( routine ).bindRemainingBuffers();

    const inputAValues = _.range( 0, options.inputASize ).map( () => options.order.type.generateRandom( true ) ).sort( options.order.compare );
    const inputBValues = _.range( 0, options.inputBSize ).map( () => options.order.type.generateRandom( true ) ).sort( options.order.compare );
    const expectedValues = [ ...inputAValues, ...inputBValues ].sort( options.order.compare );
    const actualValues = await procedure.standaloneExecute( deviceContext, { a: inputAValues, b: inputBValues } );

    procedure.dispose();

    return compareArrays( options.order.type, { a: inputAValues, b: inputBValues }, expectedValues, actualValues );
  } );
};

{
  const workgroupSize = 64;
  const grainSize = 8;

  const options = {
    inputASize: 1300,
    inputBSize: 1000,
    workgroupSize: workgroupSize,
    grainSize: grainSize
  } as const;

  testMergeSimpleModule( {
    // eslint-disable-next-line no-object-spread-on-non-literals
    ...options,
    name: 'i32 merge simple',
    order: I32Order
  } );

  testMergeSimpleModule( {
    // eslint-disable-next-line no-object-spread-on-non-literals
    ...options,
    name: 'u32 merge simple',
    order: U32Order
  } );

  testMergeSimpleModule( {
    // eslint-disable-next-line no-object-spread-on-non-literals
    ...options,
    name: 'u32 reverse merge simple',
    order: U32ReverseOrder
  } );

  testMergeSimpleModule( {
    // eslint-disable-next-line no-object-spread-on-non-literals
    ...options,
    name: 'vec2u merge simple',
    order: Vec2uLexicographicalOrder
  } );
}
