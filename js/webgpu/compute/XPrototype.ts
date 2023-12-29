// Copyright 2023, University of Colorado Boulder

/**
 * TODO: remove
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BufferResource, BufferSlot, DeviceContext, DirectRoutineBlueprint, Executor, getArrayType, mainReduceWGSL, PipelineBlueprint, Procedure, Routine, RoutineBlueprint, u32, U32Add } from '../../imports.js';

/*
We are creating a framework around WebGPU's compute shader APIs so that we can easily vary the bind group and buffer
sharing (for profiling or optimization), while providing a convenient interface for writing shaders.

TODO: describe the API we're working with

TODO: flesh out this description and current work
 */

export default class XPrototype {
  public static async test(): Promise<string | null> {
    const device = ( await DeviceContext.getDevice() )!;
    assert && assert( device );

    const deviceContext = new DeviceContext( device );

    const binaryOp = U32Add;

    const workgroupSize = 256;
    const grainSize = 8;
    const inputSize = workgroupSize * grainSize * 5 - 27;

    // TODO: make sure we're including testing WITH logging(!)
    const log = false;
    const maxItemCount = workgroupSize * grainSize * 10; // pretend

    const inputSlot = new BufferSlot( getArrayType( binaryOp.type, maxItemCount, binaryOp.identity ) );
    const middleSlot = new BufferSlot( getArrayType( binaryOp.type, Math.ceil( maxItemCount / ( workgroupSize * grainSize ) ), binaryOp.identity ) );
    const outputSlot = new BufferSlot( getArrayType( binaryOp.type, 1 ) ); // TODO

    // TODO: inspect all usages of everything, look for simplification opportunities

    const firstRoutineBlueprint = new DirectRoutineBlueprint( {
      name: 'first',
      log: log,
      create: blueprint => mainReduceWGSL<number>( blueprint, {
        input: inputSlot,
        output: middleSlot,
        binaryOp: binaryOp,
        workgroupSize: workgroupSize,
        grainSize: grainSize,
        loadReducedOptions: {
          lengthExpression: u32( inputSize )
        }
      } ),
      execute: ( context, dispatch, stageInputSize: number ) => {
        dispatch( context, Math.ceil( stageInputSize / ( workgroupSize * grainSize ) ) );
      }
    } );

    const secondRoutineBlueprint = new DirectRoutineBlueprint( {
      name: 'second',
      log: log,
      create: blueprint => mainReduceWGSL<number>( blueprint, {
        input: middleSlot,
        output: outputSlot,
        binaryOp: binaryOp,
        workgroupSize: workgroupSize,
        grainSize: grainSize,
        loadReducedOptions: {
          lengthExpression: u32( Math.ceil( inputSize / ( workgroupSize * grainSize ) ) )
        }
      } ),
      execute: ( context, dispatch, stageInputSize: number ) => {
        dispatch( context, Math.ceil( stageInputSize / ( workgroupSize * grainSize ) ) );
      }
    } );

    // TODO: really refine all of the types here

    const combinedBlueprint = new RoutineBlueprint( [
      ...firstRoutineBlueprint.pipelineBlueprints,
      ...secondRoutineBlueprint.pipelineBlueprints
    ], ( context, inputSize: number ) => {
      // TODO: Is there a way we can set up these combinations so that we specify a list of child blueprints AND the inputs?
      firstRoutineBlueprint.execute( context, inputSize );
      secondRoutineBlueprint.execute( context, Math.ceil( inputSize / ( workgroupSize * grainSize ) ) );
    } );

    const routine = await Routine.create(
      deviceContext,
      combinedBlueprint,
      [],
      Routine.INDIVIDUAL_LAYOUT_STRATEGY,
      ( context, execute, input: number[] ) => {
        context.setTypedBufferValue( inputSlot, input );

        execute( context, input.length );

        return context.getTypedBufferValue( outputSlot );
      }
    );

    const procedure = new Procedure( routine );

    procedure.bindAllBuffers();

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

    console.log( 'inputValues', inputValues );
    console.log( 'expectedValues', expectedValues );
    console.log( 'actualValues', actualValues );

    return null;
  }
}
alpenglow.register( 'XPrototype', XPrototype );
