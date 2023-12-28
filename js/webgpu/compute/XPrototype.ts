// Copyright 2023, University of Colorado Boulder

/**
 * TODO: remove
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BufferResource, BufferSlot, DeviceContext, Executor, getArrayType, mainReduceWGSL, PipelineBlueprint, Procedure, Routine, RoutineBlueprint, u32, U32Add, WGSLContext } from '../../imports.js';

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

    const inputType = getArrayType( binaryOp.type, maxItemCount, binaryOp.identity );
    const middleType = getArrayType( binaryOp.type, Math.ceil( maxItemCount / ( workgroupSize * grainSize ) ), binaryOp.identity );
    const outputType = getArrayType( binaryOp.type, 1 ); // TODO

    const inputSlot = new BufferSlot( inputType );
    const middleSlot = new BufferSlot( middleType );
    const outputSlot = new BufferSlot( outputType );

    // TODO: inspect all usages of everything, look for simplification opportunities

    const firstPipelineBlueprint = new PipelineBlueprint(
      'first',
      // TODO: have the 'main' ones directly do this context add.
      context => context.add( 'main', mainReduceWGSL<number>( context, {
        binaryOp: binaryOp,
        workgroupSize: workgroupSize,
        grainSize: grainSize,
        loadReducedOptions: {
          lengthExpression: u32( inputSize )
        },
        // TODO: rename bindings to... slots?
        // TODO: actually, just have 'inputSlot', 'outputSlot'.
        bindings: {
          input: inputSlot,
          output: middleSlot
        }
      } ) ),
      log
    );

    const secondPipelineBlueprint = new PipelineBlueprint(
      'second',
      context => context.add( 'main', mainReduceWGSL<number>( context, {
        binaryOp: binaryOp,
        workgroupSize: workgroupSize,
        grainSize: grainSize,
        loadReducedOptions: {
          lengthExpression: u32( Math.ceil( inputSize / ( workgroupSize * grainSize ) ) )
        },
        bindings: {
          input: middleSlot,
          output: outputSlot
        }
      } ) ),
      log
    );

    const firstRoutineBlueprint = new RoutineBlueprint( [ firstPipelineBlueprint ], ( context, stageInputSize: number ) => {
      context.dispatch( firstPipelineBlueprint, Math.ceil( stageInputSize / ( workgroupSize * grainSize ) ) );
    } );

    const secondRoutineBlueprint = new RoutineBlueprint( [ secondPipelineBlueprint ], ( context, stageInputSize: number ) => {
      context.dispatch( secondPipelineBlueprint, Math.ceil( stageInputSize / ( workgroupSize * grainSize ) ) );
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

    // TODO: better combinations
    // TODO: ... should we parameterize the output type?
    let promise: Promise<number[]>;
    const testBlueprint = new RoutineBlueprint( combinedBlueprint.pipelineBlueprints, ( context, input: number[] ) => {

      // TODO: slice it?
      context.setTypedBufferValue( inputSlot, input );

      combinedBlueprint.execute( context, input.length );

      promise = context.getTypedBufferValue( outputSlot );

      // context.getTypedBufferValue( outputSlot ).then( output => console.log( output ) ).catch( err => console.error( err ) );
    } );

    const routine = await Routine.create(
      deviceContext,
      testBlueprint,
      [],
      Routine.INDIVIDUAL_LAYOUT_STRATEGY
    );

    const procedure = new Procedure( routine );

    procedure.bindAllBuffers();

    const inputValues = _.range( 0, inputSize ).map( () => binaryOp.type.generateRandom( false ) );
    const expectedValues = [ inputValues.reduce( ( a, b ) => binaryOp.apply( a, b ), binaryOp.identity ) ];

    const actualValues = await Executor.execute( deviceContext, log, async executor => {
      const separateComputePasses = false;

      // TODO: parameterize things?
      procedure.execute( executor, inputValues, {
        separateComputePasses: separateComputePasses
      } );

      return promise;
    }, {
      logBuffer: log ? ( procedure.resourceMap.get( WGSLContext.LOG_BUFFER_SLOT )! as BufferResource ).buffer : null
    } );

    procedure.dispose();

    console.log( 'inputValues', inputValues );
    console.log( 'expectedValues', expectedValues );
    console.log( 'actualValues', actualValues );

    return null;
  }
}
alpenglow.register( 'XPrototype', XPrototype );
