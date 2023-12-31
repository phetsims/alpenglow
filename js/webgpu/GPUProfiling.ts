// Copyright 2023, University of Colorado Boulder

/**
 * GPU profiling of tests.
 *
 * NOTE: Launch Chrome with the below command line parameters to enable the timestamp query feature:
 *
 * open -a "Google Chrome Canary" --args --enable-dawn-features=allow_unsafe_apis --enable-webgpu-developer-features --disable-dawn-features=timestamp_quantization
 *
 * or to dump shaders also:
 * open -a "Google Chrome Canary" --args --enable-dawn-features=allow_unsafe_apis,dump_shaders --enable-webgpu-developer-features --disable-dawn-features=timestamp_quantization
 *
 * NOTE: Potentially add dump_shaders - Dumped shaders will be log via EmitLog, thus printed "
      "in Chrome console or consumed by user-defined callback function.",
      "https://crbug.com/dawn/792"
 *
 * TODO: try disable_workgroup_init sometime, to see if we can get more parallelism, maybe record_detailed_timing_in_trace_events, disable_timestamp_query_conversion
 * TODO: --disable-dawn-features=timestamp_quantization
 *
 * Note: Dawn toggles at https://dawn.googlesource.com/dawn/+/refs/heads/main/src/dawn/native/Toggles.cpp
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BasicExecution, OldBindingType, BufferLogger, OldComputeShader, OldComputeShaderDispatchOptions, OldComputeShaderSourceOptions, DeviceContext, OldExecution, TimestampLogger, TimestampLoggerResult, wgsl_f32_reduce_raked_blocked, wgsl_f32_reduce_raked_striped_blocked, wgsl_f32_reduce_raked_striped_blocked_convergent, wgsl_f32_reduce_simple } from '../imports.js';
import Random from '../../../dot/js/Random.js';
import { combineOptions } from '../../../phet-core/js/optionize.js';

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
      // deviceContext => GPUProfiling.getReduceRakedBlockedProfiler( deviceContext, workgroupSize, numbers, 2 ),
      // deviceContext => GPUProfiling.getReduceRakedBlockedProfiler( deviceContext, workgroupSize, numbers, 3 ),
      // deviceContext => GPUProfiling.getReduceRakedBlockedProfiler( deviceContext, workgroupSize, numbers, 4 ),
      // deviceContext => GPUProfiling.getReduceRakedBlockedProfiler( deviceContext, workgroupSize, numbers, 5 ),
      deviceContext => GPUProfiling.getReduceRakedBlockedProfiler( deviceContext, workgroupSize, numbers, 8 ),
      // deviceContext => GPUProfiling.getReduceRakedBlockedProfiler( deviceContext, workgroupSize, numbers, 16 )

      // deviceContext => GPUProfiling.getReduceRakedStripedBlockedProfiler( deviceContext, workgroupSize, numbers, 4 ),
      deviceContext => GPUProfiling.getReduceRakedStripedBlockedProfiler( deviceContext, workgroupSize, numbers, 8 ),
      deviceContext => GPUProfiling.getReduceRakedStripedBlockedConvergentProfiler( deviceContext, workgroupSize, numbers, 8 )
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

    const shaderOptions = {
      workgroupSize: workgroupSize,
      identity: '0f',
      combine: ( a: string, b: string ) => `${a} + ${b}`
    };

    const shader0 = OldComputeShader.fromSource(
      device, 'f32_reduce_simple 0', wgsl_f32_reduce_simple, [
        OldBindingType.READ_ONLY_STORAGE_BUFFER,
        OldBindingType.STORAGE_BUFFER
      ], combineOptions<OldComputeShaderSourceOptions>( {
        inputSize: inputSize
      }, shaderOptions )
    );
    const shader1 = OldComputeShader.fromSource(
      device, 'f32_reduce_simple 1', wgsl_f32_reduce_simple, [
        OldBindingType.READ_ONLY_STORAGE_BUFFER,
        OldBindingType.STORAGE_BUFFER
      ], combineOptions<OldComputeShaderSourceOptions>( {
        inputSize: Math.ceil( inputSize / ( workgroupSize ) )
      }, shaderOptions )
    );
    const shader2 = OldComputeShader.fromSource(
      device, 'f32_reduce_simple 2', wgsl_f32_reduce_simple, [
        OldBindingType.READ_ONLY_STORAGE_BUFFER,
        OldBindingType.STORAGE_BUFFER
      ], combineOptions<OldComputeShaderSourceOptions>( {
        inputSize: Math.ceil( inputSize / ( workgroupSize * workgroupSize ) )
      }, shaderOptions )
    );

    return new GPUProfiler( 'f32_reduce_simple', async () => {
      const timestampLogger = new TimestampLogger( deviceContext, 100 ); // capacity is probably overkill
      const dispatchOptions: OldComputeShaderDispatchOptions = {
        timestampLogger: timestampLogger
      };

      const inputBuffer = deviceContext.createBuffer( 4 * inputSize );
      device.queue.writeBuffer( inputBuffer, 0, numbers.buffer );

      const firstMiddleBuffer = deviceContext.createBuffer( 4 * Math.ceil( inputSize / ( workgroupSize ) ) );
      const secondMiddleBuffer = deviceContext.createBuffer( 4 * Math.ceil( inputSize / ( workgroupSize * workgroupSize ) ) );
      const outputBuffer = deviceContext.createBuffer( 4 );

      const encoder = device.createCommandEncoder( { label: 'the encoder' } );

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

    const shaderOptions = {
      workgroupSize: workgroupSize,
      grainSize: grainSize,
      identity: '0f',
      combine: ( a: string, b: string ) => `${a} + ${b}`
    };

    const shader0 = OldComputeShader.fromSource(
      device, 'f32_reduce_raked_blocked 0', wgsl_f32_reduce_raked_blocked, [
        OldBindingType.READ_ONLY_STORAGE_BUFFER,
        OldBindingType.STORAGE_BUFFER
      ], combineOptions<OldComputeShaderSourceOptions>( {
        inputSize: inputSize
      }, shaderOptions )
    );
    const shader1 = OldComputeShader.fromSource(
      device, 'f32_reduce_raked_blocked 1', wgsl_f32_reduce_raked_blocked, [
        OldBindingType.READ_ONLY_STORAGE_BUFFER,
        OldBindingType.STORAGE_BUFFER
      ], combineOptions<OldComputeShaderSourceOptions>( {
        inputSize: Math.ceil( inputSize / ( workgroupSize * grainSize ) )
      }, shaderOptions )
    );
    const shader2 = OldComputeShader.fromSource(
      device, 'f32_reduce_raked_blocked 2', wgsl_f32_reduce_raked_blocked, [
        OldBindingType.READ_ONLY_STORAGE_BUFFER,
        OldBindingType.STORAGE_BUFFER
      ], combineOptions<OldComputeShaderSourceOptions>( {
        inputSize: Math.ceil( inputSize / ( workgroupSize * workgroupSize * grainSize * grainSize ) )
      }, shaderOptions )
    );

    return new GPUProfiler( `f32_reduce_raked_blocked ${grainSize}`, async () => {
      const timestampLogger = new TimestampLogger( deviceContext, 100 ); // capacity is probably overkill
      const dispatchOptions: OldComputeShaderDispatchOptions = {
        timestampLogger: timestampLogger
      };

      const inputBuffer = deviceContext.createBuffer( 4 * inputSize );
      device.queue.writeBuffer( inputBuffer, 0, numbers.buffer );

      const firstMiddleBuffer = deviceContext.createBuffer( 4 * Math.ceil( inputSize / ( workgroupSize * grainSize ) ) );
      const secondMiddleBuffer = deviceContext.createBuffer( 4 * Math.ceil( inputSize / ( workgroupSize * workgroupSize * grainSize * grainSize ) ) );
      const outputBuffer = deviceContext.createBuffer( 4 );

      const encoder = device.createCommandEncoder( { label: 'the encoder' } );

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

  public static async getReduceRakedStripedBlockedProfiler(
    deviceContext: DeviceContext,
    workgroupSize: number,
    numbers: Float32Array,
    grainSize: number
  ): Promise<GPUProfiler> {
    const device = deviceContext.device;

    const bufferLogger = new BufferLogger( deviceContext );

    const inputSize = numbers.length;

    const shaderOptions = {
      workgroupSize: workgroupSize,
      grainSize: grainSize,
      identity: '0f',
      combine: ( a: string, b: string ) => `${a} + ${b}`
    } as const;

    const shader0 = OldComputeShader.fromSource(
      device, 'f32_reduce_raked_striped_blocked 0', wgsl_f32_reduce_raked_striped_blocked, [
        OldBindingType.READ_ONLY_STORAGE_BUFFER,
        OldBindingType.STORAGE_BUFFER
      ], combineOptions<OldComputeShaderSourceOptions>( {
        inputSize: inputSize
      }, shaderOptions )
    );
    const shader1 = OldComputeShader.fromSource(
      device, 'f32_reduce_raked_striped_blocked 1', wgsl_f32_reduce_raked_striped_blocked, [
        OldBindingType.READ_ONLY_STORAGE_BUFFER,
        OldBindingType.STORAGE_BUFFER
      ], combineOptions<OldComputeShaderSourceOptions>( {
        inputSize: Math.ceil( inputSize / ( workgroupSize * grainSize ) )
      }, shaderOptions )
    );
    const shader2 = OldComputeShader.fromSource(
      device, 'f32_reduce_raked_striped_blocked 2', wgsl_f32_reduce_raked_striped_blocked, [
        OldBindingType.READ_ONLY_STORAGE_BUFFER,
        OldBindingType.STORAGE_BUFFER
      ], combineOptions<OldComputeShaderSourceOptions>( {
        inputSize: Math.ceil( inputSize / ( workgroupSize * workgroupSize * grainSize * grainSize ) )
      }, shaderOptions )
    );

    return new GPUProfiler( `f32_reduce_raked_striped_blocked ${grainSize}`, async () => {
      const timestampLogger = new TimestampLogger( deviceContext, 100 ); // capacity is probably overkill
      const dispatchOptions: OldComputeShaderDispatchOptions = {
        timestampLogger: timestampLogger
      };

      const inputBuffer = deviceContext.createBuffer( 4 * inputSize );
      device.queue.writeBuffer( inputBuffer, 0, numbers.buffer );

      const firstMiddleBuffer = deviceContext.createBuffer( 4 * Math.ceil( inputSize / ( workgroupSize * grainSize ) ) );
      const secondMiddleBuffer = deviceContext.createBuffer( 4 * Math.ceil( inputSize / ( workgroupSize * workgroupSize * grainSize * grainSize ) ) );
      const outputBuffer = deviceContext.createBuffer( 4 );

      const encoder = device.createCommandEncoder( { label: 'the encoder' } );

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

  public static async getReduceRakedStripedBlockedConvergentProfiler(
    deviceContext: DeviceContext,
    workgroupSize: number,
    numbers: Float32Array,
    grainSize: number
  ): Promise<GPUProfiler> {
    const device = deviceContext.device;
    const inputSize = numbers.length;

    const shaderOptions = {
      workgroupSize: workgroupSize,
      grainSize: grainSize,
      identity: '0f',
      combine: ( a: string, b: string ) => `${a} + ${b}`
    } as const;

    const shader0 = OldComputeShader.fromSource(
      device, 'f32_reduce_raked_striped_blocked_convergent 0', wgsl_f32_reduce_raked_striped_blocked_convergent, [
        OldBindingType.READ_ONLY_STORAGE_BUFFER,
        OldBindingType.STORAGE_BUFFER
      ], combineOptions<OldComputeShaderSourceOptions>( {
        inputSize: inputSize
      }, shaderOptions )
    );
    const shader1 = OldComputeShader.fromSource(
      device, 'f32_reduce_raked_striped_blocked_convergent 1', wgsl_f32_reduce_raked_striped_blocked_convergent, [
        OldBindingType.READ_ONLY_STORAGE_BUFFER,
        OldBindingType.STORAGE_BUFFER
      ], combineOptions<OldComputeShaderSourceOptions>( {
        inputSize: Math.ceil( inputSize / ( workgroupSize * grainSize ) )
      }, shaderOptions )
    );
    const shader2 = OldComputeShader.fromSource(
      device, 'f32_reduce_raked_striped_blocked_convergent 2', wgsl_f32_reduce_raked_striped_blocked_convergent, [
        OldBindingType.READ_ONLY_STORAGE_BUFFER,
        OldBindingType.STORAGE_BUFFER
      ], combineOptions<OldComputeShaderSourceOptions>( {
        inputSize: Math.ceil( inputSize / ( workgroupSize * workgroupSize * grainSize * grainSize ) )
      }, shaderOptions )
    );

    // TODO: are we... causing slower patterns with our new profiling pattern?
    return new GPUProfiler( `f32_reduce_raked_striped_blocked_convergent ${grainSize}`, async () => {
      const execution = new BasicExecution( deviceContext );

      const outputArray = await execution.executeSingle( async ( encoder: GPUCommandEncoder, execution: OldExecution ) => {
        const inputBuffer = execution.createBuffer( 4 * inputSize );
        device.queue.writeBuffer( inputBuffer, 0, numbers.buffer );

        const firstMiddleBuffer = execution.createBuffer( 4 * Math.ceil( inputSize / ( workgroupSize * grainSize ) ) );
        const secondMiddleBuffer = execution.createBuffer( 4 * Math.ceil( inputSize / ( workgroupSize * workgroupSize * grainSize * grainSize ) ) );
        const outputBuffer = execution.createBuffer( 4 );

        execution.dispatch( shader0, [
          inputBuffer, firstMiddleBuffer
        ], Math.ceil( inputSize / ( workgroupSize * grainSize ) ), 1, 1 );
        execution.dispatch( shader1, [
          firstMiddleBuffer, secondMiddleBuffer
        ], Math.ceil( inputSize / ( workgroupSize * workgroupSize * grainSize * grainSize ) ), 1, 1 );
        execution.dispatch( shader2, [
          secondMiddleBuffer, outputBuffer
        ], 1, 1, 1 );

        return execution.f32Numbers( outputBuffer );
      } );

      const expectedValue = _.sum( [ ...numbers ] );
      const actualValue = outputArray[ 0 ];

      // Yay inaccurate math!
      if ( Math.abs( expectedValue - actualValue ) > 1 ) {
        throw new Error( 'invalid result' );
      }

      const timestampResult = await execution.timestampResultPromise;

      if ( !timestampResult ) {
        throw new Error( 'missing timestamps' );
      }

      return timestampResult;
    } );
  }
}

alpenglow.register( 'GPUProfiling', GPUProfiling );
