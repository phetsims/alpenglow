// Copyright 2023, University of Colorado Boulder

/**
 * Helper object for common execution patterns. See methods on DeviceContext for details.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BufferLogger, ByteEncoder, ComputeShader, ComputeShaderDispatchOptions, DeviceContext, TimestampLogger, TimestampLoggerResult } from '../imports.js';
import { optionize3 } from '../../../phet-core/js/optionize.js';

export type ExecutionAnyCallback<T> = ( encoder: GPUCommandEncoder, execution: Execution ) => T;
export type ExecutionSingleCallback<T> = ( encoder: GPUCommandEncoder, execution: Execution ) => Promise<T>;
export type ExecutionMultipleCallback<T extends Record<string, Promise<unknown>>> = ( encoder: GPUCommandEncoder, execution: Execution ) => T;
export type Unpromised<T extends Record<string, Promise<unknown>>> = { [ K in keyof T ]: T[ K ] extends Promise<infer U> ? U : T[ K ] };

export type ExecutionOptions = {
  timestampLog?: boolean;
  timestampLoggerCapacity?: number;
};

const DEFAULT_OPTIONS = {
  timestampLog: true,
  timestampLoggerCapacity: 100
};

type Execution = {
  encoder: GPUCommandEncoder;
  createBuffer: ( size: number ) => GPUBuffer;
  createDataBuffer: ( data: ArrayBufferView ) => GPUBuffer;
  createU32Buffer: ( data: number[] ) => GPUBuffer;
  createI32Buffer: ( data: number[] ) => GPUBuffer;
  createF32Buffer: ( data: number[] ) => GPUBuffer;
  createByteEncoderBuffer: ( encoder: ByteEncoder ) => GPUBuffer;
  arrayBuffer: ( buffer: GPUBuffer ) => Promise<ArrayBuffer>;
  u32: ( buffer: GPUBuffer ) => Promise<Uint32Array>;
  i32: ( buffer: GPUBuffer ) => Promise<Int32Array>;
  f32: ( buffer: GPUBuffer ) => Promise<Float32Array>;
  u32Numbers: ( buffer: GPUBuffer ) => Promise<number[]>;
  i32Numbers: ( buffer: GPUBuffer ) => Promise<number[]>;
  f32Numbers: ( buffer: GPUBuffer ) => Promise<number[]>;
  getDispatchOptions: () => ComputeShaderDispatchOptions;
  dispatch: (
    shader: ComputeShader,
    resources: ( GPUBuffer | GPUTextureView )[],
    dispatchX?: number,
    dispatchY?: number,
    dispatchZ?: number
  ) => void;
  dispatchIndirect: (
    shader: ComputeShader,
    resources: ( GPUBuffer | GPUTextureView )[],
    indirectBuffer: GPUBuffer,
    indirectOffset: number
  ) => void;
};
export default Execution;

export abstract class ExecutableShader<In, Out> {
  public constructor(
    public readonly execute: ( execution: Execution, input: In ) => Promise<Out>,
    public readonly dispose?: () => void
  ) {}
}

export type ExecutableShaderTemplate<In, Out> = ( deviceContext: DeviceContext ) => Promise<ExecutableShader<In, Out>>;

export abstract class BaseExecution {
  public readonly bufferLogger: BufferLogger;

  protected readonly buffersToCleanup: GPUBuffer[] = [];

  public constructor(
    public readonly deviceContext: DeviceContext,
    public readonly encoder: GPUCommandEncoder
  ) {
    this.bufferLogger = new BufferLogger( deviceContext );
  }

  public abstract getDispatchOptions(): ComputeShaderDispatchOptions;

  public createBuffer( size: number ): GPUBuffer {
    const buffer = this.deviceContext.createBuffer( size );
    this.buffersToCleanup.push( buffer );
    return buffer;
  }

  public createDataBuffer( data: ArrayBufferView ): GPUBuffer {
    const buffer = this.deviceContext.createDataBuffer( data );
    this.buffersToCleanup.push( buffer );
    return buffer;
  }

  public createU32Buffer( data: number[] ): GPUBuffer {
    const buffer = this.deviceContext.createU32Buffer( data );
    this.buffersToCleanup.push( buffer );
    return buffer;
  }

  public createI32Buffer( data: number[] ): GPUBuffer {
    const buffer = this.deviceContext.createI32Buffer( data );
    this.buffersToCleanup.push( buffer );
    return buffer;
  }

  public createF32Buffer( data: number[] ): GPUBuffer {
    const buffer = this.deviceContext.createF32Buffer( data );
    this.buffersToCleanup.push( buffer );
    return buffer;
  }

  public createByteEncoderBuffer( encoder: ByteEncoder ): GPUBuffer {
    const buffer = this.deviceContext.createByteEncoderBuffer( encoder );
    this.buffersToCleanup.push( buffer );
    return buffer;
  }

  public async arrayBuffer(
    buffer: GPUBuffer
  ): Promise<ArrayBuffer> {
    return this.bufferLogger.arrayBuffer( this.encoder, buffer );
  }

  public async u32(
    buffer: GPUBuffer
  ): Promise<Uint32Array> {
    return this.bufferLogger.u32( this.encoder, buffer );
  }

  public async i32(
    buffer: GPUBuffer
  ): Promise<Int32Array> {
    return this.bufferLogger.i32( this.encoder, buffer );
  }

  public async f32(
    buffer: GPUBuffer
  ): Promise<Float32Array> {
    return this.bufferLogger.f32( this.encoder, buffer );
  }

  public async u32Numbers(
    buffer: GPUBuffer
  ): Promise<number[]> {
    return this.bufferLogger.u32Numbers( this.encoder, buffer );
  }

  public async i32Numbers(
    buffer: GPUBuffer
  ): Promise<number[]> {
    return this.bufferLogger.i32Numbers( this.encoder, buffer );
  }

  public async f32Numbers(
    buffer: GPUBuffer
  ): Promise<number[]> {
    return this.bufferLogger.f32Numbers( this.encoder, buffer );
  }

  public dispatch(
    shader: ComputeShader,
    resources: ( GPUBuffer | GPUTextureView )[],
    dispatchX = 1,
    dispatchY = 1,
    dispatchZ = 1
  ): void {
    shader.dispatch( this.encoder, resources, dispatchX, dispatchY, dispatchZ, this.getDispatchOptions() );
  }

  public dispatchIndirect(
    shader: ComputeShader,
    resources: ( GPUBuffer | GPUTextureView )[],
    indirectBuffer: GPUBuffer,
    indirectOffset: number
  ): void {
    shader.dispatchIndirect( this.encoder, resources, indirectBuffer, indirectOffset, this.getDispatchOptions() );
  }
}

export class BasicExecution extends BaseExecution implements Execution {

  public readonly timestampLogger: TimestampLogger;
  public readonly timestampResultPromise: Promise<TimestampLoggerResult | null>;

  private timestampResultResolve!: ( result: TimestampLoggerResult | null ) => void;

  public constructor(
    deviceContext: DeviceContext,
    providedOptions?: ExecutionOptions
  ) {
    super(
      deviceContext,
      deviceContext.device.createCommandEncoder( { label: 'the encoder' } )
    );

    const options = optionize3<ExecutionOptions>()( {}, DEFAULT_OPTIONS, providedOptions );

    this.timestampLogger = new TimestampLogger(
      options.timestampLog ? deviceContext : null,
      options.timestampLoggerCapacity
    );

    this.timestampResultPromise = new Promise( resolve => {
      this.timestampResultResolve = resolve;
    } );
  }

  public getDispatchOptions(): ComputeShaderDispatchOptions {
    return {
      timestampLogger: this.timestampLogger
    };
  }

  private async executeInternal<T>(
    callback: ExecutionAnyCallback<T>
  ): Promise<T> {
    this.timestampLogger.mark( this.encoder, 'start' );

    const promise = callback( this.encoder, this );

    this.timestampLogger.mark( this.encoder, 'end' );

    this.timestampLogger.resolve( this.encoder, this.bufferLogger ).then( result => this.timestampResultResolve( result ) ).catch( e => { throw e; } );

    const commandBuffer = this.encoder.finish();
    this.deviceContext.device.queue.submit( [ commandBuffer ] );
    await this.bufferLogger.complete();

    this.buffersToCleanup.forEach( buffer => buffer.destroy() );

    this.timestampLogger.dispose();

    return promise;
  }

  public async executeSingle<T>(
    callback: ExecutionSingleCallback<T>
  ): Promise<T> {
    return this.executeInternal( callback );
  }

  public async execute<T extends Record<string, Promise<unknown>>>(
    callback: ExecutionMultipleCallback<T>
  ): Promise<Unpromised<T>> {
    const promise = this.executeInternal( callback );

    const result: Partial<Unpromised<T>> = {};
    for ( const key in promise ) {
      // @ts-expect-error Is there a way to get this to type check?
      result[ key ] = await promise[ key ];
    }

    return result as Unpromised<T>;
  }
}

alpenglow.register( 'BasicExecution', BasicExecution );
