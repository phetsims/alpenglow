// Copyright 2023, University of Colorado Boulder

/**
 * Helper object for common execution patterns. See methods on DeviceContext for details.
 *
 * @deprecated
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BufferLogger, ByteEncoder, ComputeShader, ComputeShaderDispatchOptions, ConsoleLogger, DeviceContext, TimestampLogger, TimestampLoggerResult } from '../imports.js';
import { optionize3 } from '../../../phet-core/js/optionize.js';
import Utils from '../../../dot/js/Utils.js';

export type ExecutionAnyCallback<T> = ( encoder: GPUCommandEncoder, execution: Execution ) => T;
export type ExecutionSingleCallback<T> = ( encoder: GPUCommandEncoder, execution: Execution ) => Promise<T>;
export type ExecutionMultipleCallback<T extends Record<string, Promise<unknown>>> = ( encoder: GPUCommandEncoder, execution: Execution ) => T;
export type Unpromised<T extends Record<string, Promise<unknown>>> = { [ K in keyof T ]: T[ K ] extends Promise<infer U> ? U : T[ K ] };

export type ExecutionOptions = {
  timestampLog?: boolean;
  timestampLoggerCapacity?: number;
  log?: boolean;
  logBufferSize?: number;
};

const DEFAULT_OPTIONS = {
  timestampLog: true,
  timestampLoggerCapacity: 100,
  log: false,
  logBufferSize: 1 << 22
};

// @deprecated
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
  setLogBarrierShader: ( shader: ComputeShader ) => void;
};
export default Execution;

// We'll likely want this typed in the future, so disabling the linter so we don't have to modify a ton of places.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type ExecutableShaderOptions<In, Out> = {
  log?: boolean;
  dispose?: () => void;
};

// We'll likely want this typed in the future, so disabling the linter so we don't have to modify a ton of places.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type ExecutableShaderExternalOptions<In, Out> = {
  log?: boolean;
};

const DEFAULT_EXECUTABLE_SHADER_OPTIONS = {
  log: false,
  dispose: _.noop
};

// @deprecated
export abstract class ExecutableShader<In, Out> {

  public readonly log: boolean;
  public readonly dispose: () => void;

  public constructor(
    public readonly execute: ( execution: Execution, input: In ) => Promise<Out>,
    providedOptions?: ExecutableShaderOptions<In, Out>
  ) {
    const options = optionize3<ExecutableShaderOptions<In, Out>>()( {}, DEFAULT_EXECUTABLE_SHADER_OPTIONS, providedOptions );

    this.log = options.log;
    this.dispose = options.dispose;
  }
}

export type ExecutableShaderTemplate<In, Out> = ( deviceContext: DeviceContext ) => Promise<ExecutableShader<In, Out>>;

// @deprecated
export abstract class BaseExecution {
  public readonly bufferLogger: BufferLogger;

  protected readonly buffersToCleanup: GPUBuffer[] = [];

  private logBarrierShader: ComputeShader | null = null;

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

  public setLogBarrierShader( shader: ComputeShader ): void {
    this.logBarrierShader = shader;
  }

  public dispatch(
    shader: ComputeShader,
    resources: ( GPUBuffer | GPUTextureView )[],
    dispatchX = 1,
    dispatchY = 1,
    dispatchZ = 1
  ): void {
    this.logBarrierShader && this.logBarrierShader.dispatch( this.encoder, [], 1, 1, 1, this.getDispatchOptions() );

    shader.dispatch( this.encoder, resources, dispatchX, dispatchY, dispatchZ, this.getDispatchOptions() );
  }

  public dispatchIndirect(
    shader: ComputeShader,
    resources: ( GPUBuffer | GPUTextureView )[],
    indirectBuffer: GPUBuffer,
    indirectOffset: number
  ): void {
    this.logBarrierShader && this.logBarrierShader.dispatch( this.encoder, [], 1, 1, 1, this.getDispatchOptions() );

    shader.dispatchIndirect( this.encoder, resources, indirectBuffer, indirectOffset, this.getDispatchOptions() );
  }
}

// @deprecated
export class BasicExecution extends BaseExecution implements Execution {

  public readonly timestampLogger: TimestampLogger;
  public readonly timestampResultPromise: Promise<TimestampLoggerResult | null>;
  private readonly log: boolean;
  private readonly logBufferSize: number;
  private logBuffer: GPUBuffer | null = null;

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

    this.log = options.log;
    this.logBufferSize = options.logBufferSize;
  }

  public getDispatchOptions(): ComputeShaderDispatchOptions {
    return {
      timestampLogger: this.timestampLogger,
      logBuffer: this.logBuffer
    };
  }

  private async executeInternal<T>(
    callback: ExecutionAnyCallback<T>
  ): Promise<T> {

    this.logBuffer = this.log ? this.createBuffer( this.logBufferSize ) : null;

    const promise = callback( this.encoder, this );

    const logPromise = this.logBuffer ? this.arrayBuffer( this.logBuffer ) : Promise.resolve( null );

    this.timestampLogger.resolve( this.encoder, this.bufferLogger ).then( result => this.timestampResultResolve( result ) ).catch( e => { throw e; } );

    const commandBuffer = this.encoder.finish();
    this.deviceContext.device.queue.submit( [ commandBuffer ] );
    await this.bufferLogger.complete();

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
