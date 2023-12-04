// Copyright 2023, University of Colorado Boulder

/**
 * Tests for SingleReduceShader
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { asyncTestWithDeviceContext, BlueprintTests, U32Add } from '../../../imports.js';

QUnit.module( 'WGSL SingleReduceShader' );

// type Options<T> = StrictOmit<WithRequired<SingleReduceShaderOptions<T>, 'binaryOp'>, 'workgroupSize' | 'grainSize' | 'log' | 'bindings'>;
//
// const testSingleReduceShader = <T>(
//   options: Options<T>
// ) => {
//   const binaryOp = options.binaryOp;
//   const name = `${binaryOp.name} SingleReduceShader ${options.loadReducedOptions?.sequentialReduceStyle}`;
//   asyncTestWithDeviceContext( name, async deviceContext => {
//     const workgroupSize = 256;
//     const grainSize = 8;
//     const inputSize = workgroupSize * grainSize * 5 - 27;
//
//     const shader = await SingleReduceShader.create<T>( deviceContext, name, combineOptions<SingleReduceShaderOptions<T>>( {
//       workgroupSize: workgroupSize,
//       grainSize: grainSize,
//       loadReducedOptions: combineOptions<Required<SingleReduceShaderOptions<T>>[ 'loadReducedOptions' ]>( {
//         lengthExpression: u32( inputSize )
//       }, options.loadReducedOptions ),
//       log: false,
//       bindings: {
//         // TODO: connect these up to our shader handling
//         input: new Binding( BindingType.READ_ONLY_STORAGE_BUFFER, new BindingLocation( 0, 0 ) ),
//         output: new Binding( BindingType.STORAGE_BUFFER, new BindingLocation( 0, 1 ) )
//       }
//     }, options ) );
//
//     const inputValues = _.range( 0, inputSize ).map( () => binaryOp.type.generateRandom( false ) );
//
//     const actualValues = await deviceContext.executeShader( shader, inputValues );
//     const expectedValues = _.chunk( inputValues.slice( 0, inputSize ), workgroupSize * grainSize ).map( inputValuesForWorkgroup => {
//       return inputValuesForWorkgroup.reduce( ( a, b ) => binaryOp.apply( a, b ), binaryOp.identity );
//     } );
//
//     return compareArrays( binaryOp.type, inputValues, expectedValues, actualValues );
//   } );
// };
//
// ( [ 'factored', 'unfactored', 'nested' ] as const ).forEach( sequentialReduceStyle => {
//   testSingleReduceShader( {
//     binaryOp: U32Add,
//     loadReducedOptions: {
//       sequentialReduceStyle: sequentialReduceStyle
//     }
//   } );
//
//   testSingleReduceShader( {
//     binaryOp: Vec2uBic,
//     loadReducedOptions: {
//       inputAccessOrder: 'blocked',
//       sequentialReduceStyle: sequentialReduceStyle
//     }
//   } );
//
//   // TODO: test more
// } );
//
// const testBoundDoubleReduceShader = <T>(
//   options: Options<T>
// ) => {
//   const binaryOp = options.binaryOp;
//   const name = `${binaryOp.name} (bound) double reduce ${options.loadReducedOptions?.sequentialReduceStyle}`;
//
//   asyncTestWithDeviceContext( name, async deviceContext => {
//     const workgroupSize = 256;
//     const grainSize = 8;
//     const inputSize = workgroupSize * grainSize * 5 - 27;
//
//     // TODO: make sure we're including testing WITH logging(!)
//     const log = false;
//     const maxItemCount = workgroupSize * grainSize * 10; // pretend
//
//     const bindGroupLayout = BindGroupLayout.createZero(
//       deviceContext,
//       name,
//       log,
//       {
//         input: BindingType.READ_ONLY_STORAGE_BUFFER,
//         middle: BindingType.STORAGE_BUFFER,
//         output: BindingType.STORAGE_BUFFER
//       }
//     );
//
//     const pipelineLayout = PipelineLayout.create( deviceContext, bindGroupLayout );
//
//     const firstPipeline = await ComputePipeline.withContextAsync(
//       deviceContext,
//       `${name} first`,
//       context => mainReduceWGSL( context, combineOptions<SingleReduceShaderOptions<T>>( {
//         workgroupSize: workgroupSize,
//         grainSize: grainSize,
//         loadReducedOptions: combineOptions<Required<SingleReduceShaderOptions<T>>[ 'loadReducedOptions' ]>( {
//           lengthExpression: u32( inputSize )
//         }, options.loadReducedOptions ),
//         log: log,
//         bindings: {
//           input: pipelineLayout.bindingMap.input,
//           output: pipelineLayout.bindingMap.middle
//         }
//       }, options ) ),
//       pipelineLayout,
//       log
//     );
//
//     const secondPipeline = await ComputePipeline.withContextAsync(
//       deviceContext,
//       `${name} second`,
//       context => mainReduceWGSL( context, combineOptions<SingleReduceShaderOptions<T>>( {
//         workgroupSize: workgroupSize,
//         grainSize: grainSize,
//         loadReducedOptions: combineOptions<Required<SingleReduceShaderOptions<T>>[ 'loadReducedOptions' ]>( {
//           lengthExpression: u32( Math.ceil( inputSize / ( workgroupSize * grainSize ) ) )
//         }, options.loadReducedOptions ),
//         log: log,
//         bindings: {
//           input: pipelineLayout.bindingMap.middle,
//           output: pipelineLayout.bindingMap.output
//         }
//       }, options ) ),
//       pipelineLayout,
//       log
//     );
//
//     //////////////////////////////////
//
//     const inputTypedBuffer = TypedBuffer.createArray( deviceContext, binaryOp.type, maxItemCount, binaryOp.identity );
//     const middleTypedBuffer = TypedBuffer.createArray( deviceContext, binaryOp.type, Math.ceil( maxItemCount / ( workgroupSize * grainSize ) ), binaryOp.identity );
//     const outputTypedBuffer = TypedBuffer.createArray( deviceContext, binaryOp.type, Math.ceil( maxItemCount / ( workgroupSize * grainSize * workgroupSize * grainSize ) ), binaryOp.identity );
//
//     const bindGroup = BindGroup.createZero(
//       deviceContext,
//       name,
//       bindGroupLayout,
//       log,
//       {
//         input: inputTypedBuffer,
//         middle: middleTypedBuffer,
//         output: outputTypedBuffer
//       }
//     );
//
//     //////////////////////////////////
//
//     const inputValues = _.range( 0, inputSize ).map( () => binaryOp.type.generateRandom( false ) );
//     const expectedValues = [ inputValues.reduce( ( a, b ) => binaryOp.apply( a, b ), binaryOp.identity ) ];
//
//     const firstDispatchSize = Math.ceil( inputValues.length / ( workgroupSize * grainSize ) );
//     const secondDispatchSize = Math.ceil( firstDispatchSize / ( workgroupSize * grainSize * workgroupSize * grainSize ) );
//
//     const actualValues = await Executor.execute(
//       deviceContext,
//       log, // TODO: in whatever we create, store the log:boolean (duh)
//       async executor => {
//         executor.setTypedBufferValue( inputTypedBuffer, inputValues );
//
//         executor.getComputePass( 'main' )
//           .dispatchPipeline( firstPipeline, [ bindGroup ], firstDispatchSize )
//           .dispatchPipeline( secondPipeline, [ bindGroup ], secondDispatchSize )
//           .end();
//
//         return executor.getTypedBufferValue( outputTypedBuffer );
//       }
//     );
//
//     inputTypedBuffer.dispose();
//     middleTypedBuffer.dispose();
//     outputTypedBuffer.dispose();
//
//     return compareArrays( binaryOp.type, inputValues, expectedValues, actualValues );
//   } );
// };
//
// ( [ 'factored', 'unfactored', 'nested' ] as const ).forEach( sequentialReduceStyle => {
//   testBoundDoubleReduceShader( {
//     binaryOp: U32Add,
//     loadReducedOptions: {
//       sequentialReduceStyle: sequentialReduceStyle
//     }
//   } );
//
//   testBoundDoubleReduceShader( {
//     binaryOp: Vec2uBic,
//     loadReducedOptions: {
//       inputAccessOrder: 'blocked',
//       sequentialReduceStyle: sequentialReduceStyle
//     }
//   } );
//
//   // TODO: test more
// } );

asyncTestWithDeviceContext( 'Blueprint test', async deviceContext => {
  return BlueprintTests.test( deviceContext, 'Blueprint test', {
    binaryOp: U32Add,
    loadReducedOptions: {
      sequentialReduceStyle: 'factored'
    }
  } );
} );