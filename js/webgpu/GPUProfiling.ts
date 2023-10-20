// Copyright 2023, University of Colorado Boulder

/**
 * GPU profiling of tests.
 *
 * NOTE: Launch Chrome with --enable-dawn-features=allow_unsafe_apis to enable the timestamp query feature.
 *
 * open -a "Google Chrome Canary" --args --enable-dawn-features=allow_unsafe_apis
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, Binding, BufferLogger, ComputeShader, ComputeShaderDispatchOptions, DeviceContext, TimestampLogger, wgsl_reduce_raked_blocked } from '../imports.js';
import Random from '../../../dot/js/Random.js';

// eslint-disable-next-line bad-sim-text
const random = new Random();

export default class GPUProfiling {
  public static async test(): Promise<void> {

    const device = await DeviceContext.getDevice( {
      maxLimits: true,
      timestampQuery: true
    } );

    assert && assert( device, 'Device required' );
    if ( !device ) {
      return;
    }

    const deviceContext = new DeviceContext( device );

    const bufferLogger = new BufferLogger( deviceContext );

    const workgroupSize = 256;
    const grainSize = 5;
    const inputSize = workgroupSize * workgroupSize * ( workgroupSize - 3 ) - 27 * 301;

    const numbers = _.range( 0, inputSize ).map( () => random.nextDouble() );

    const shader0 = ComputeShader.fromSource(
      device, 'reduce_raked_blocked 0', wgsl_reduce_raked_blocked, [
        Binding.READ_ONLY_STORAGE_BUFFER,
        Binding.STORAGE_BUFFER
      ], {
        workgroupSize: workgroupSize,
        grainSize: grainSize,
        inputSize: inputSize
      }
    );
    const shader1 = ComputeShader.fromSource(
      device, 'reduce_raked_blocked 1', wgsl_reduce_raked_blocked, [
        Binding.READ_ONLY_STORAGE_BUFFER,
        Binding.STORAGE_BUFFER
      ], {
        workgroupSize: workgroupSize,
        grainSize: grainSize,
        inputSize: Math.ceil( inputSize / ( workgroupSize * grainSize ) )
      }
    );
    const shader2 = ComputeShader.fromSource(
      device, 'reduce_raked_blocked 2', wgsl_reduce_raked_blocked, [
        Binding.READ_ONLY_STORAGE_BUFFER,
        Binding.STORAGE_BUFFER
      ], {
        workgroupSize: workgroupSize,
        grainSize: grainSize,
        inputSize: Math.ceil( inputSize / ( workgroupSize * workgroupSize * grainSize * grainSize ) )
      }
    );

    const timestampLogger = new TimestampLogger( deviceContext, 100 ); // capacity is probably overkill
    const dispatchOptions: ComputeShaderDispatchOptions = {
      timestampLogger: timestampLogger
    };

    const inputBuffer = deviceContext.createBuffer( 4 * inputSize );
    device.queue.writeBuffer( inputBuffer, 0, new Float32Array( numbers ).buffer );

    const firstMiddleBuffer = deviceContext.createBuffer( 4 * Math.ceil( inputSize / ( workgroupSize * grainSize ) ) );
    const secondMiddleBuffer = deviceContext.createBuffer( 4 * Math.ceil( inputSize / ( workgroupSize * workgroupSize * grainSize * grainSize ) ) );
    const outputBuffer = deviceContext.createBuffer( 4 );
    const resultBuffer = deviceContext.createMapReadableBuffer( 4 );

    const encoder = device.createCommandEncoder( { label: 'the encoder' } );

    timestampLogger.mark( encoder, 'start' );

    shader0.dispatch( encoder, [
      inputBuffer, firstMiddleBuffer
    ], Math.ceil( inputSize / ( workgroupSize * grainSize ) ), 1, 1, dispatchOptions );
    shader1.dispatch( encoder, [
      firstMiddleBuffer, secondMiddleBuffer
    ], Math.ceil( inputSize / ( workgroupSize * workgroupSize * grainSize * grainSize ) ), 1, 1, dispatchOptions );
    shader2.dispatch( encoder, [
      secondMiddleBuffer, outputBuffer
    ], 1, 1, 1, dispatchOptions );

    timestampLogger.mark( encoder, 'post-shader' );

    // TODO: use BufferLogger for this instead
    encoder.copyBufferToBuffer( outputBuffer, 0, resultBuffer, 0, resultBuffer.size );

    timestampLogger.mark( encoder, 'post-result-transfer' );

    const timestampResultPromise = timestampLogger.resolve( encoder, bufferLogger );

    const commandBuffer = encoder.finish();
    device.queue.submit( [ commandBuffer ] );

    await device.queue.onSubmittedWorkDone();
    await bufferLogger.complete();

    const timestampResult = await timestampResultPromise;

    const outputArray = await DeviceContext.getMappedFloatArray( resultBuffer );

    inputBuffer.destroy();
    firstMiddleBuffer.destroy();
    secondMiddleBuffer.destroy();
    outputBuffer.destroy();
    resultBuffer.destroy();
    timestampLogger.dispose();

    const expectedValue = _.sum( numbers );
    const actualValue = outputArray[ 0 ];

    console.log( `actualValue: ${actualValue}` );
    console.log( `expectedValue: ${expectedValue}` );

    if ( timestampResult ) {
      console.log( timestampResult.timestampNames );
      console.log( timestampResult.timestamps );
    }
  }
}

alpenglow.register( 'GPUProfiling', GPUProfiling );
