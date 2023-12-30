// Copyright 2023, University of Colorado Boulder

/**
 * Assorted WGSL example tests
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { asyncTestWithDevice, BufferArraySlot, BufferResource, compareArrays, Executor, getArrayType, PipelineBlueprint, Procedure, ReduceModule, Routine, u32, U32Add } from '../../../imports.js';

QUnit.module( 'ReduceModuleTests' );

asyncTestWithDevice( 'u32 add 2-level initial reduce', async ( device, deviceContext ) => {
const binaryOp = U32Add;
  const workgroupSize = 256;
  const grainSize = 8;
  const inputSize = workgroupSize * grainSize * 5 - 27;

  // TODO: make sure we're including testing WITH logging(!)
  const log = false;
  const maxItemCount = workgroupSize * grainSize * 10; // pretend

  const inputSlot = new BufferArraySlot( getArrayType( binaryOp.type, maxItemCount, binaryOp.identity ) );
  const outputSlot = new BufferArraySlot( getArrayType( binaryOp.type, 1 ) ); // TODO

  // TODO: inspect all usages of everything, look for simplification opportunities

  const reduceModule = new ReduceModule( {
    name: 'u32 add 2-level initial reduce',
    log: log,
    input: inputSlot,
    output: outputSlot,
    binaryOp: binaryOp,
    workgroupSize: workgroupSize,
    grainSize: grainSize,
    lengthExpression: u32( inputSize )
  } );

  const routine = await Routine.create(
    deviceContext,
    reduceModule,
    [],
    Routine.INDIVIDUAL_LAYOUT_STRATEGY,
    ( context, execute, input: number[] ) => {
      context.setTypedBufferValue( inputSlot, input );

      execute( context, input.length );

      return context.getTypedBufferValue( outputSlot );
    }
  );

  const procedure = new Procedure( routine );

  procedure.bindRemainingBuffers();

  const inputValues = _.range( 0, inputSize ).map( () => binaryOp.type.generateRandom( false ) );
  const expectedValues = [ inputValues.reduce( ( a, b ) => binaryOp.apply( a, b ), binaryOp.identity ) ];

  const actualValues = await Executor.execute( deviceContext, log, async executor => {
    const separateComputePasses = false;

    return procedure.execute( executor, inputValues, {
      separateComputePasses: separateComputePasses
    } );
  }, {
    logBuffer: log ? ( procedure.resourceMap.get( PipelineBlueprint.LOG_BUFFER_SLOT )! as BufferResource ).buffer : null
  } );

  procedure.dispose();

  return compareArrays( binaryOp.type, inputValues, expectedValues, actualValues );
} );
