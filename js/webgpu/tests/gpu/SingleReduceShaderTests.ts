// Copyright 2023, University of Colorado Boulder

/**
 * Tests for SingleReduceShader
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { addLineNumbers, asyncTestWithDeviceContext, BindGroup, BindGroupLayout, Binding, BindingLocation, BoundBinding, BoundBuffer, BoundResource, BufferLogger, compareArrays, ConsoleLogger, mainReduceWGSL, partialWGSLBeautify, PipelineLayout, SingleReduceShader, SingleReduceShaderOptions, TimestampLogger, TypedBuffer, u32, U32Add, U32Type, Vec2uBic, WGSLContext } from '../../../imports.js';
import { combineOptions } from '../../../../../phet-core/js/optionize.js';
import WithRequired from '../../../../../phet-core/js/types/WithRequired.js';
import StrictOmit from '../../../../../phet-core/js/types/StrictOmit.js';
import Utils from '../../../../../dot/js/Utils.js';

QUnit.module( 'WGSL SingleReduceShader' );

type Options<T> = StrictOmit<WithRequired<SingleReduceShaderOptions<T>, 'binaryOp'>, 'workgroupSize' | 'grainSize' | 'log' | 'bindingLocations'>;

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
      bindingLocations: {
        // TODO: connect these up to our shader handling
        input: new BindingLocation( 0, 0 ),
        output: new BindingLocation( 0, 1 )
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

const testBoundSingleReduceShader = <T>(
  options: Options<T>
) => {
  const binaryOp = options.binaryOp;
  const name = `${binaryOp.name} (bound) SingleReduceShader ${options.loadReducedOptions?.sequentialReduceStyle}`;

  asyncTestWithDeviceContext( name, async deviceContext => {
    const workgroupSize = 256;
    const grainSize = 8;
    const inputSize = workgroupSize * grainSize * 5 - 27;

    const log = false;
    const maxItemCount = workgroupSize * grainSize * 10;
    const timestampLog = false;

    const inputBinding = new BoundBinding( Binding.READ_ONLY_STORAGE_BUFFER, new BindingLocation( 0, 0 ) );
    const outputBinding = new BoundBinding( Binding.STORAGE_BUFFER, new BindingLocation( 0, 1 ) );

    const wgslContext = new WGSLContext( name, log ).with( context => mainReduceWGSL( context, combineOptions<SingleReduceShaderOptions<T>>( {
      workgroupSize: workgroupSize,
      grainSize: grainSize,
      loadReducedOptions: combineOptions<Required<SingleReduceShaderOptions<T>>[ 'loadReducedOptions' ]>( {
        lengthExpression: u32( inputSize )
      }, options.loadReducedOptions ),
      log: false,
      bindingLocations: {
        input: inputBinding.location,
        output: outputBinding.location
      }
    }, options ) ) );
    const wgsl = partialWGSLBeautify( wgslContext.toString() );

    console.groupCollapsed( `[shader] ${name}` );
    console.log( addLineNumbers( wgsl ) );
    console.groupEnd();

    const module = deviceContext.device.createShaderModule( {
      label: name,
      code: wgsl
    } );

    const logBinding = wgslContext.getBoundLogBinding();

    const bindGroupLayout = new BindGroupLayout(
      deviceContext,
      `${name} bind group layout`,
      0,
      [
        inputBinding,
        outputBinding,
        ...( log ? [ logBinding ] : [] )
      ]
    );

    const pipelineLayout = new PipelineLayout( deviceContext, [ bindGroupLayout ] );

    const pipelineDescriptor: GPUComputePipelineDescriptor = {
      label: `${name} pipeline`,
      layout: pipelineLayout.layout,
      compute: {
        module: module,
        entryPoint: 'main'
      }
    };

    const pipeline = await deviceContext.device.createComputePipelineAsync( pipelineDescriptor );

    //////////////////////////////////

    const inputTypedBuffer = TypedBuffer.createArray( deviceContext, binaryOp.type, maxItemCount, binaryOp.identity );
    const outputTypedBuffer = TypedBuffer.createArray( deviceContext, binaryOp.type, Math.ceil( maxItemCount / ( workgroupSize * grainSize ) ), binaryOp.identity );

    const inputBoundBuffer = new BoundBuffer( inputTypedBuffer, inputBinding );
    const outputBoundBuffer = new BoundBuffer( outputTypedBuffer, outputBinding );

    const boundResources: BoundResource[] = [ inputBoundBuffer, outputBoundBuffer ];

    let logTypedBuffer: TypedBuffer<number[]> | null = null;
    let logBoundBuffer: BoundBuffer<number[]> | null = null;
    if ( log ) {
      logTypedBuffer = TypedBuffer.createArray( deviceContext, U32Type, 1 << 22 );
      logBoundBuffer = new BoundBuffer( logTypedBuffer, logBinding );
      boundResources.push( logBoundBuffer );
    }

    // TODO: buffer disposal(!)

    const bindGroup = new BindGroup(
      deviceContext,
      `${name} bind group`,
      bindGroupLayout,
      boundResources
    );

    //////////////////////////////////

    const inputValues = _.range( 0, inputSize ).map( () => binaryOp.type.generateRandom( false ) );
    const expectedValues = _.chunk( inputValues.slice( 0, inputSize ), workgroupSize * grainSize ).map( inputValuesForWorkgroup => {
      return inputValuesForWorkgroup.reduce( ( a, b ) => binaryOp.apply( a, b ), binaryOp.identity );
    } );


    inputTypedBuffer.setValue( deviceContext.device, inputValues );

    const dispatchSize = Math.ceil( inputValues.length / ( workgroupSize * grainSize ) );

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
    computePass.setPipeline( pipeline );
    computePass.setBindGroup( 0, bindGroup.bindGroup );
    computePass.dispatchWorkgroups( dispatchSize, 1, 1 );
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
    outputTypedBuffer.dispose();
    logTypedBuffer?.dispose();

    const actualValues = await outputPromise;

    return compareArrays( binaryOp.type, inputValues, expectedValues, actualValues );
  } );
};

( [ 'factored', 'unfactored', 'nested' ] as const ).forEach( sequentialReduceStyle => {
  testBoundSingleReduceShader( {
    binaryOp: U32Add,
    loadReducedOptions: {
      sequentialReduceStyle: sequentialReduceStyle
    }
  } );

  testBoundSingleReduceShader( {
    binaryOp: Vec2uBic,
    loadReducedOptions: {
      inputAccessOrder: 'blocked',
      sequentialReduceStyle: sequentialReduceStyle
    }
  } );

  // TODO: test more
} );
