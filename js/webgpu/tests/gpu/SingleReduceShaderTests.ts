// Copyright 2023, University of Colorado Boulder

/**
 * Tests for SingleReduceShader
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { addLineNumbers, asyncTestWithDeviceContext, BindGroup, BindGroupLayout, Binding, BindingLocation, BindingType, BoundBuffer, BoundResource, BufferLogger, compareArrays, ConsoleLogger, mainLogBarrier, mainReduceWGSL, partialWGSLBeautify, PipelineLayout, SingleReduceShader, SingleReduceShaderOptions, TimestampLogger, TypedBuffer, u32, U32Add, Vec2uBic, WGSLContext } from '../../../imports.js';
import { combineOptions } from '../../../../../phet-core/js/optionize.js';
import WithRequired from '../../../../../phet-core/js/types/WithRequired.js';
import StrictOmit from '../../../../../phet-core/js/types/StrictOmit.js';
import Utils from '../../../../../dot/js/Utils.js';

QUnit.module( 'WGSL SingleReduceShader' );

type Options<T> = StrictOmit<WithRequired<SingleReduceShaderOptions<T>, 'binaryOp'>, 'workgroupSize' | 'grainSize' | 'log' | 'bindings'>;

const testSingleReduceShader = <T>(
  options: Options<T>
) => {
  const binaryOp = options.binaryOp;
  const name = `${binaryOp.name} SingleReduceShader ${options.loadReducedOptions?.sequentialReduceStyle}`;
  asyncTestWithDeviceContext( name, async deviceContext => {
    const workgroupSize = 256;
    const grainSize = 8;
    const inputSize = workgroupSize * grainSize * 5 - 27;

    const shader = await SingleReduceShader.create<T>( deviceContext, name, combineOptions<SingleReduceShaderOptions<T>>( {
      workgroupSize: workgroupSize,
      grainSize: grainSize,
      loadReducedOptions: combineOptions<Required<SingleReduceShaderOptions<T>>[ 'loadReducedOptions' ]>( {
        lengthExpression: u32( inputSize )
      }, options.loadReducedOptions ),
      log: false,
      bindings: {
        // TODO: connect these up to our shader handling
        input: new Binding( BindingType.READ_ONLY_STORAGE_BUFFER, new BindingLocation( 0, 0 ) ),
        output: new Binding( BindingType.STORAGE_BUFFER, new BindingLocation( 0, 1 ) )
      }
    }, options ) );

    const inputValues = _.range( 0, inputSize ).map( () => binaryOp.type.generateRandom( false ) );

    const actualValues = await deviceContext.executeShader( shader, inputValues );
    const expectedValues = _.chunk( inputValues.slice( 0, inputSize ), workgroupSize * grainSize ).map( inputValuesForWorkgroup => {
      return inputValuesForWorkgroup.reduce( ( a, b ) => binaryOp.apply( a, b ), binaryOp.identity );
    } );

    return compareArrays( binaryOp.type, inputValues, expectedValues, actualValues );
  } );
};

( [ 'factored', 'unfactored', 'nested' ] as const ).forEach( sequentialReduceStyle => {
  testSingleReduceShader( {
    binaryOp: U32Add,
    loadReducedOptions: {
      sequentialReduceStyle: sequentialReduceStyle
    }
  } );

  testSingleReduceShader( {
    binaryOp: Vec2uBic,
    loadReducedOptions: {
      inputAccessOrder: 'blocked',
      sequentialReduceStyle: sequentialReduceStyle
    }
  } );

  // TODO: test more
} );

const testBoundDoubleReduceShader = <T>(
  options: Options<T>
) => {
  const binaryOp = options.binaryOp;
  const name = `${binaryOp.name} (bound) double reduce ${options.loadReducedOptions?.sequentialReduceStyle}`;

  asyncTestWithDeviceContext( name, async deviceContext => {
    const workgroupSize = 256;
    const grainSize = 8;
    const inputSize = workgroupSize * grainSize * 5 - 27;

    const log = true;
    const maxItemCount = workgroupSize * grainSize * 10; // pretend
    const timestampLog = false;

    const inputBinding = new Binding( BindingType.READ_ONLY_STORAGE_BUFFER, new BindingLocation( 0, 0 ) );
    const middleBinding = new Binding( BindingType.STORAGE_BUFFER, new BindingLocation( 0, 1 ) );
    const outputBinding = new Binding( BindingType.STORAGE_BUFFER, new BindingLocation( 0, 2 ) );
    const logBinding = WGSLContext.getBoundLogBinding();

    const bindGroupLayout = new BindGroupLayout(
      deviceContext,
      name,
      0,
      [
        inputBinding,
        middleBinding,
        outputBinding,
        ...( log ? [ logBinding ] : [] )
      ]
    );

    const pipelineLayout = new PipelineLayout( deviceContext, [ bindGroupLayout ] );

    const firstWgslContext = new WGSLContext( `${name} first`, log ).with( context => mainReduceWGSL( context, combineOptions<SingleReduceShaderOptions<T>>( {
      workgroupSize: workgroupSize,
      grainSize: grainSize,
      loadReducedOptions: combineOptions<Required<SingleReduceShaderOptions<T>>[ 'loadReducedOptions' ]>( {
        lengthExpression: u32( inputSize )
      }, options.loadReducedOptions ),
      log: log,
      bindings: {
        input: inputBinding,
        output: middleBinding
      }
    }, options ) ) );
    const firstWGSL = partialWGSLBeautify( firstWgslContext.toString() );

    console.groupCollapsed( `[shader] ${name} first` );
    console.log( addLineNumbers( firstWGSL ) );
    console.groupEnd();

    const firstModule = deviceContext.device.createShaderModule( {
      label: `${name} first`,
      code: firstWGSL
    } );

    const firstPipeline = await deviceContext.device.createComputePipelineAsync( {
      label: `${name} pipeline`,
      layout: pipelineLayout.layout,
      compute: {
        module: firstModule,
        entryPoint: 'main'
      }
    } );

    const secondWgslContext = new WGSLContext( `${name} second`, log ).with( context => mainReduceWGSL( context, combineOptions<SingleReduceShaderOptions<T>>( {
      workgroupSize: workgroupSize,
      grainSize: grainSize,
      loadReducedOptions: combineOptions<Required<SingleReduceShaderOptions<T>>[ 'loadReducedOptions' ]>( {
        lengthExpression: u32( Math.ceil( inputSize / ( workgroupSize * grainSize ) ) )
      }, options.loadReducedOptions ),
      log: log,
      bindings: {
        input: middleBinding,
        output: outputBinding
      }
    }, options ) ) );
    const secondWGSL = partialWGSLBeautify( secondWgslContext.toString() );

    console.groupCollapsed( `[shader] ${name} second` );
    console.log( addLineNumbers( secondWGSL ) );
    console.groupEnd();

    const secondModule = deviceContext.device.createShaderModule( {
      label: `${name} second`,
      code: secondWGSL
    } );

    const secondPipeline = await deviceContext.device.createComputePipelineAsync( {
      label: `${name} pipeline`,
      layout: pipelineLayout.layout,
      compute: {
        module: secondModule,
        entryPoint: 'main'
      }
    } );

    let logBarrierPipeline: GPUComputePipeline | null = null;
    if ( log ) {
      const logBarrierWgslContext = new WGSLContext( `${name} logBarrier`, log ).with( context => mainLogBarrier( context ) );
      const logBarrierWGSL = partialWGSLBeautify( logBarrierWgslContext.toString() );

      console.groupCollapsed( '[shader] logBarrier' );
      console.log( addLineNumbers( logBarrierWGSL ) );
      console.groupEnd();

      const logBarrierModule = deviceContext.device.createShaderModule( {
        label: 'logBarrier',
        code: logBarrierWGSL
      } );

      logBarrierPipeline = await deviceContext.device.createComputePipelineAsync( {
        label: 'logBarrier pipeline',
        layout: pipelineLayout.layout, // TODO: use the pipeline layout for every one?
        compute: {
          module: logBarrierModule,
          entryPoint: 'main'
        }
      } );
    }

    //////////////////////////////////

    const inputTypedBuffer = TypedBuffer.createArray( deviceContext, binaryOp.type, maxItemCount, binaryOp.identity );
    const middleTypedBuffer = TypedBuffer.createArray( deviceContext, binaryOp.type, Math.ceil( maxItemCount / ( workgroupSize * grainSize ) ), binaryOp.identity );
    const outputTypedBuffer = TypedBuffer.createArray( deviceContext, binaryOp.type, Math.ceil( maxItemCount / ( workgroupSize * grainSize * workgroupSize * grainSize ) ), binaryOp.identity );

    const inputBoundBuffer = new BoundBuffer( inputTypedBuffer, inputBinding );
    const middleBoundBuffer = new BoundBuffer( middleTypedBuffer, middleBinding );
    const outputBoundBuffer = new BoundBuffer( outputTypedBuffer, outputBinding );

    const boundResources: BoundResource[] = [ inputBoundBuffer, middleBoundBuffer, outputBoundBuffer ];

    let logBoundBuffer: BoundBuffer<number[]> | null = null;
    if ( log ) {
      logBoundBuffer = new BoundBuffer( deviceContext.getLogTypedBuffer(), logBinding );
      boundResources.push( logBoundBuffer );
    }

    const bindGroup = new BindGroup(
      deviceContext,
      `${name} bind group`,
      bindGroupLayout,
      boundResources
    );

    //////////////////////////////////

    const inputValues = _.range( 0, inputSize ).map( () => binaryOp.type.generateRandom( false ) );
    const expectedValues = [ inputValues.reduce( ( a, b ) => binaryOp.apply( a, b ), binaryOp.identity ) ];

    inputTypedBuffer.setValue( deviceContext.device, inputValues );

    const firstDispatchSize = Math.ceil( inputValues.length / ( workgroupSize * grainSize ) );
    const secondDispatchSize = Math.ceil( firstDispatchSize / ( workgroupSize * grainSize * workgroupSize * grainSize ) );

    const encoder = deviceContext.device.createCommandEncoder( { label: 'the encoder' } );
    const bufferLogger = new BufferLogger( deviceContext );
    const timestampLogger = new TimestampLogger(
      timestampLog ? deviceContext : null,
      100
    );

    const computePassDescriptor: GPUComputePassDescriptor = {
      label: `${name} compute pass` // TODO: note indirect
    };

    if ( timestampLogger ) {
      const timestampWrites = timestampLogger.getGPUComputePassTimestampWrites( name );
      if ( timestampWrites ) {
        computePassDescriptor.timestampWrites = timestampWrites;
      }
    }
    // TODO!
    // else if ( timestampWrites ) {
    //   computePassDescriptor.timestampWrites = timestampWrites;
    // }

    const computePass: GPUComputePassEncoder = encoder.beginComputePass( computePassDescriptor );
    computePass.setBindGroup( 0, bindGroup.bindGroup );
    computePass.setPipeline( firstPipeline );
    computePass.dispatchWorkgroups( firstDispatchSize, 1, 1 );
    if ( logBarrierPipeline ) {
      computePass.setPipeline( logBarrierPipeline );
      computePass.dispatchWorkgroups( 1, 1, 1 );
    }
    computePass.setPipeline( secondPipeline );
    computePass.dispatchWorkgroups( secondDispatchSize, 1, 1 );
    computePass.end();

    const outputPromise = outputTypedBuffer.getValue( encoder, bufferLogger );

    // TODO: staging ring for our "out" buffers?

    const logPromise = logBoundBuffer ? bufferLogger.arrayBuffer( encoder, logBoundBuffer.typedBuffer.buffer ) : Promise.resolve( null );

    const commandBuffer = encoder.finish();
    deviceContext.device.queue.submit( [ commandBuffer ] );

    await bufferLogger.complete();

    const logResult = await logPromise;

    if ( logResult ) {
      const data = new Uint32Array( logResult );
      const length = data[ 0 ];
      const usedMessage = `logging used ${length} of ${data.length - 1} u32s (${Utils.roundSymmetric( 100 * length / ( data.length - 1 ) )}%)`;
      console.log( usedMessage );

      const logData = ConsoleLogger.analyze( logResult );

      logData.forEach( shaderData => {
        shaderData.logLines.forEach( lineData => {
          console.log(
            shaderData.shaderName,
            `>>> ${lineData.info.logName}${lineData.additionalIndex !== null ? ` (${lineData.additionalIndex})` : ''}`,
            lineData.info.lineToLog( lineData )
          );
        } );
      } );

      console.log( usedMessage );
    }

    timestampLogger.dispose();
    inputTypedBuffer.dispose();
    middleTypedBuffer.dispose();
    outputTypedBuffer.dispose();

    const actualValues = await outputPromise;

    return compareArrays( binaryOp.type, inputValues, expectedValues, actualValues );
  } );
};

( [ 'factored', 'unfactored', 'nested' ] as const ).forEach( sequentialReduceStyle => {
  testBoundDoubleReduceShader( {
    binaryOp: U32Add,
    loadReducedOptions: {
      sequentialReduceStyle: sequentialReduceStyle
    }
  } );

  testBoundDoubleReduceShader( {
    binaryOp: Vec2uBic,
    loadReducedOptions: {
      inputAccessOrder: 'blocked',
      sequentialReduceStyle: sequentialReduceStyle
    }
  } );

  // TODO: test more
} );
