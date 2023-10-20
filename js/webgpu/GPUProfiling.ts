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

import { alpenglow, Binding, BufferLogger, ComputeShader, ComputeShaderDispatchOptions, DeviceContext, TimestampLogger, TimestampLoggerResult, wgsl_reduce_raked_blocked, wgsl_reduce_simple } from '../imports.js';
import Random from '../../../dot/js/Random.js';

// eslint-disable-next-line bad-sim-text
const random = new Random();

class GPUProfiler {

  public readonly results: TimestampLoggerResult[] = [];

  public constructor(
    public readonly name: string,
    public readonly callback: () => Promise<TimestampLoggerResult>
  ) {}

  public async addResult(): Promise<void> {
    this.results.push( await this.callback() );
  }

  public async discardResult(): Promise<void> {
    await this.callback();
  }

  public getAverage(): TimestampLoggerResult {
    return TimestampLoggerResult.averageTimestamps( this.results );
  }
}

export default class GPUProfiling {
  public static async test(): Promise<void> {

    const workgroupSize = 256;
    const inputSize = workgroupSize * workgroupSize * ( workgroupSize - 3 ) - 27 * 301;
    const numbers = new Float32Array( _.range( 0, inputSize ).map( () => random.nextDouble() ) );

    await GPUProfiling.loopingTest( [
      deviceContext => GPUProfiling.getReduceSimpleProfiler( deviceContext, workgroupSize, numbers ),
      deviceContext => GPUProfiling.getReduceRakedBlockedProfiler( deviceContext, workgroupSize, numbers, 2 ),
      deviceContext => GPUProfiling.getReduceRakedBlockedProfiler( deviceContext, workgroupSize, numbers, 3 ),
      deviceContext => GPUProfiling.getReduceRakedBlockedProfiler( deviceContext, workgroupSize, numbers, 4 ),
      deviceContext => GPUProfiling.getReduceRakedBlockedProfiler( deviceContext, workgroupSize, numbers, 5 ),
      deviceContext => GPUProfiling.getReduceRakedBlockedProfiler( deviceContext, workgroupSize, numbers, 8 ),
      deviceContext => GPUProfiling.getReduceRakedBlockedProfiler( deviceContext, workgroupSize, numbers, 16 )

      // TODO: add striped rake version
    ] );
  }

  public static async loopingTest(
    profilerFactories: ( ( deviceContext: DeviceContext ) => Promise<GPUProfiler> )[]
  ): Promise<void> {

    const device = await DeviceContext.getDevice( {
      maxLimits: true,
      timestampQuery: true
    } );

    assert && assert( device, 'Device required' );
    if ( !device ) {
      return;
    }

    const deviceContext = new DeviceContext( device );

    const profilers: GPUProfiler[] = [];
    for ( const profilerFactory of profilerFactories ) {
      profilers.push( await profilerFactory( deviceContext ) );
    }

    const discardQuantity = 3;
    console.log( 'warmup' );
    for ( let i = 0; i < discardQuantity; i++ ) {
      for ( const profiler of profilers ) {
        await profiler.discardResult();
      }
    }

    console.log( 'profiling' );
    const quantity = 1000;
    for ( let i = 1; i <= quantity; i++ ) {
      const profilerOrder = random.shuffle( _.range( 0, profilers.length ) );
      for ( const profilerIndex of profilerOrder ) {
        await profilers[ profilerIndex ].addResult();
      }
      if ( i % 10 === 0 ) {
        console.log( i );
        for ( const profiler of profilers ) {
          console.log( profiler.name );
          console.log( profiler.getAverage().toString() );
        }
      }
    }
  }

  public static async getReduceSimpleProfiler(
    deviceContext: DeviceContext,
    workgroupSize: number,
    numbers: Float32Array
  ): Promise<GPUProfiler> {
    const device = deviceContext.device;

    const bufferLogger = new BufferLogger( deviceContext );

    const inputSize = numbers.length;

    const shader0 = ComputeShader.fromSource(
      device, 'reduce_simple 0', wgsl_reduce_simple, [
        Binding.READ_ONLY_STORAGE_BUFFER,
        Binding.STORAGE_BUFFER
      ], {
        workgroupSize: workgroupSize,
        inputSize: inputSize
      }
    );
    const shader1 = ComputeShader.fromSource(
      device, 'reduce_simple 1', wgsl_reduce_simple, [
        Binding.READ_ONLY_STORAGE_BUFFER,
        Binding.STORAGE_BUFFER
      ], {
        workgroupSize: workgroupSize,
        inputSize: Math.ceil( inputSize / ( workgroupSize ) )
      }
    );
    const shader2 = ComputeShader.fromSource(
      device, 'reduce_simple 2', wgsl_reduce_simple, [
        Binding.READ_ONLY_STORAGE_BUFFER,
        Binding.STORAGE_BUFFER
      ], {
        workgroupSize: workgroupSize,
        inputSize: Math.ceil( inputSize / ( workgroupSize * workgroupSize ) )
      }
    );

    return new GPUProfiler( 'reduce_simple', async () => {
      const timestampLogger = new TimestampLogger( deviceContext, 100 ); // capacity is probably overkill
      const dispatchOptions: ComputeShaderDispatchOptions = {
        timestampLogger: timestampLogger
      };

      const inputBuffer = deviceContext.createBuffer( 4 * inputSize );
      device.queue.writeBuffer( inputBuffer, 0, numbers.buffer );

      const firstMiddleBuffer = deviceContext.createBuffer( 4 * Math.ceil( inputSize / ( workgroupSize ) ) );
      const secondMiddleBuffer = deviceContext.createBuffer( 4 * Math.ceil( inputSize / ( workgroupSize * workgroupSize ) ) );
      const outputBuffer = deviceContext.createBuffer( 4 );

      const encoder = device.createCommandEncoder( { label: 'the encoder' } );

      timestampLogger.mark( encoder, 'start' );

      shader0.dispatch( encoder, [
        inputBuffer, firstMiddleBuffer
      ], Math.ceil( inputSize / ( workgroupSize ) ), 1, 1, dispatchOptions );
      shader1.dispatch( encoder, [
        firstMiddleBuffer, secondMiddleBuffer
      ], Math.ceil( inputSize / ( workgroupSize * workgroupSize ) ), 1, 1, dispatchOptions );
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

      const expectedValue = _.sum( [ ...numbers ] );
      const actualValue = outputArray[ 0 ];

      // Yay inaccurate math!
      if ( Math.abs( expectedValue - actualValue ) > 1 ) {
        throw new Error( 'invalid result' );
      }

      return timestampResult;
    } );
  }

  public static async getReduceRakedBlockedProfiler(
    deviceContext: DeviceContext,
    workgroupSize: number,
    numbers: Float32Array,
    grainSize: number
  ): Promise<GPUProfiler> {
    const device = deviceContext.device;

    const bufferLogger = new BufferLogger( deviceContext );

    const inputSize = numbers.length;

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

    return new GPUProfiler( `reduce_raked_blocked ${grainSize}`, async () => {
      const timestampLogger = new TimestampLogger( deviceContext, 100 ); // capacity is probably overkill
      const dispatchOptions: ComputeShaderDispatchOptions = {
        timestampLogger: timestampLogger
      };

      const inputBuffer = deviceContext.createBuffer( 4 * inputSize );
      device.queue.writeBuffer( inputBuffer, 0, numbers.buffer );

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

      const expectedValue = _.sum( [ ...numbers ] );
      const actualValue = outputArray[ 0 ];

      // Yay inaccurate math!
      if ( Math.abs( expectedValue - actualValue ) > 1 ) {
        throw new Error( 'invalid result' );
      }

      return timestampResult;
    } );
  }
}

alpenglow.register( 'GPUProfiling', GPUProfiling );
