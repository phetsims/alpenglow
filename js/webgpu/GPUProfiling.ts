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

import { alpenglow, Binding, BufferLogger, ComputeShader, ComputeShaderDispatchOptions, DeviceContext, TimestampLogger, TimestampLoggerResult, wgsl_reduce_raked_blocked } from '../imports.js';
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

    const getTimestampResult = async () => {
      const timestampLogger = new TimestampLogger( deviceContext, 100 ); // capacity is probably overkill
      const dispatchOptions: ComputeShaderDispatchOptions = {
        timestampLogger: timestampLogger
      };

      const inputBuffer = deviceContext.createBuffer( 4 * inputSize );
      device.queue.writeBuffer( inputBuffer, 0, new Float32Array( numbers ).buffer );

      const firstMiddleBuffer = deviceContext.createBuffer( 4 * Math.ceil( inputSize / ( workgroupSize * grainSize ) ) );
      const secondMiddleBuffer = deviceContext.createBuffer( 4 * Math.ceil( inputSize / ( workgroupSize * workgroupSize * grainSize * grainSize ) ) );
      const outputBuffer = deviceContext.createBuffer( 4 );

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

      const resultPromise = bufferLogger.arrayBufferPromise( encoder, outputBuffer );

      timestampLogger.mark( encoder, 'end' );

      const timestampResultPromise = timestampLogger.resolve( encoder, bufferLogger );

      const commandBuffer = encoder.finish();
      device.queue.submit( [ commandBuffer ] );

      await device.queue.onSubmittedWorkDone();
      await bufferLogger.complete();

      const timestampResult = await timestampResultPromise;
      const outputArray = new Float32Array( await resultPromise );

      if ( !timestampResult ) {
        throw new Error( 'missing timestamps' );
      }

      inputBuffer.destroy();
      firstMiddleBuffer.destroy();
      secondMiddleBuffer.destroy();
      outputBuffer.destroy();
      timestampLogger.dispose();

      const expectedValue = _.sum( numbers );
      const actualValue = outputArray[ 0 ];

      // Yay inaccurate math!
      if ( Math.abs( expectedValue - actualValue ) > 1 ) {
        throw new Error( 'invalid result' );
      }

      return timestampResult;
    };

    const quantity = 1000;
    const timestampResults: TimestampLoggerResult[] = [];

    for ( let i = 1; i <= quantity; i++ ) {
      timestampResults.push( await getTimestampResult() );
      if ( i % 10 === 0 ) {
        console.log( i );
        console.log( TimestampLoggerResult.averageTimestamps( timestampResults ).toString() );
      }
    }
  }
}

alpenglow.register( 'GPUProfiling', GPUProfiling );
