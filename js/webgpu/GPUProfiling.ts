// Copyright 2023-2024, University of Colorado Boulder

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

import Random from '../../../dot/js/Random.js';
import { alpenglow, BufferArraySlot, BufferLogger, DeviceContext, getArrayType, Procedure, RadixSortModule, Routine, TimestampLogger, TimestampLoggerResult, U32Order, u32S } from '../imports.js';

// eslint-disable-next-line phet/bad-sim-text
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

    const u32Numbers = _.range( 0, inputSize ).map( () => random.nextInt( 1000000 ) );

    await GPUProfiling.loopingTest( [
      deviceContext => GPUProfiling.getRadixProfiler( deviceContext, u32Numbers, {
        combineStrategy: true,
        radixWorkgroupSize: 128,
        radixGrainSize: 4,
        scanWorkgroupSize: 128,
        scanGrainSize: 4,
        bitsPerPass: 8,
        bitsPerInnerPass: 2
      } )
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

  public static async getRadixProfiler(
    deviceContext: DeviceContext,
    numbers: number[],
    options: {
      combineStrategy: boolean;
      radixWorkgroupSize: number;
      radixGrainSize: number;
      scanWorkgroupSize: number;
      scanGrainSize: number;
      bitsPerPass: number;
      bitsPerInnerPass: number;
    }
  ): Promise<GPUProfiler> {

    const combineStrategy = options.combineStrategy;
    const radixWorkgroupSize = options.radixWorkgroupSize;
    const radixGrainSize = options.radixGrainSize;
    const scanWorkgroupSize = options.scanWorkgroupSize;
    const scanGrainSize = options.scanGrainSize;
    const bitsPerPass = options.bitsPerPass;
    const bitsPerInnerPass = options.bitsPerInnerPass;

    const name = `radix sort comb:${combineStrategy} radix:${radixWorkgroupSize}x${radixGrainSize} scan:${scanWorkgroupSize}x${scanGrainSize} bits:${bitsPerPass}x${bitsPerInnerPass}`;

    const order = U32Order;
    const size = numbers.length;
    const maximumSize = numbers.length;

    const inputSlot = new BufferArraySlot( getArrayType( order.type, maximumSize ) );
    const outputSlot = new BufferArraySlot( getArrayType( order.type, maximumSize ) );

    const radixSortModule = new RadixSortModule( {
      input: inputSlot,
      output: outputSlot,
      name: name,

      order: order,
      totalBits: 32,

      radixWorkgroupSize: radixWorkgroupSize,
      radixGrainSize: radixGrainSize,
      scanWorkgroupSize: scanWorkgroupSize,
      scanGrainSize: scanGrainSize,

      lengthExpression: u32S( size ),

      bitsPerPass: bitsPerPass,
      bitsPerInnerPass: bitsPerInnerPass,
      earlyLoad: false,
      scanModuleOptions: {
        areScannedReductionsExclusive: false
      }
    } );

    // TODO: can we factor out some things here, like the execute wrapper?
    const routine = await Routine.create(
      deviceContext,
      radixSortModule,
      [ inputSlot, outputSlot ],
      combineStrategy ? Routine.COMBINE_ALL_LAYOUT_STRATEGY : Routine.INDIVIDUAL_LAYOUT_STRATEGY,
      ( context, execute, input: { numbers: number[]; timestampLogger: TimestampLogger } ) => {
        context.setTypedBufferValue( inputSlot, input.numbers );

        execute( context, input.numbers.length );

        context.finish();

        // TODO: improve this?
        // TODO: doesn't seem like this is finishing!
        return input.timestampLogger.resolve( context.executor.encoder, bufferLogger );
      }
    );

    const procedure = new Procedure( routine ).bindRemainingBuffers();

    const bufferLogger = new BufferLogger( deviceContext );

    return new GPUProfiler( name, async () => {

      const timestampLogger = new TimestampLogger( deviceContext, 100 ); // capacity is probably overkill

      const timestampResult = await procedure.standaloneExecute( deviceContext, {
        numbers: numbers,
        timestampLogger: timestampLogger
      }, {
        procedureExecuteOptions: {
          separateComputePasses: true
        },
        executorOptions: {
          getTimestampWrites: name => timestampLogger.getGPUComputePassTimestampWrites( name )
        }
      } );

      if ( !timestampResult ) {
        throw new Error( 'missing timestamps' );
      }

      timestampLogger.dispose();

      return timestampResult;
    } );
  }
}

alpenglow.register( 'GPUProfiling', GPUProfiling );