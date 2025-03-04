// Copyright 2023-2025, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { optionize3 } from '../../../../phet-core/js/optionize.js';
import { alpenglow } from '../../alpenglow.js';
import type { DeviceContext } from './DeviceContext.js';
import { BufferLogger } from './BufferLogger.js';
import { ComputePass } from './ComputePass.js';
import type { TypedBuffer } from './TypedBuffer.js';
import { webgpu } from '../WebGPUAPI.js';
import { ConsoleLogger } from './ConsoleLogger.js';
import { roundSymmetric } from '../../../../dot/js/util/roundSymmetric.js';

export type ExecutorOptions = {
  getTimestampWrites?: ( name: string ) => GPUComputePassTimestampWrites | null;
  logBuffer?: GPUBuffer | null;
};

const EXECUTOR_DEFAULT_OPTIONS = {
  getTimestampWrites: _.constant( null ),
  logBuffer: null
} as const;

export class Executor {

  private getTimestampWrites: ( name: string ) => GPUComputePassTimestampWrites | null;

  public constructor(
    public readonly deviceContext: DeviceContext,
    public readonly encoder: GPUCommandEncoder,
    public readonly bufferLogger: BufferLogger,
    providedOptions?: ExecutorOptions
  ) {
    const options = optionize3<ExecutorOptions>()( {}, EXECUTOR_DEFAULT_OPTIONS, providedOptions );

    this.getTimestampWrites = options.getTimestampWrites;
  }

  public getComputePass( name: string ): ComputePass {
    const computePassDescriptor: GPUComputePassDescriptor = {
      label: `${name} compute pass`
    };

    const timestampWrites = this.getTimestampWrites( name );
    if ( timestampWrites !== null ) {
      computePassDescriptor.timestampWrites = timestampWrites;
    }

    return new ComputePass( this.encoder, computePassDescriptor );
  }

  public setTypedBufferValue<T>( typedBuffer: TypedBuffer<T>, value: T ): void {
    typedBuffer.setValue( this.deviceContext.device, value );
  }

  public async getTypedBufferValue<T>( typedBuffer: TypedBuffer<T> ): Promise<T> {
    return typedBuffer.getValue( this.encoder, this.bufferLogger );
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

  public static async execute<T>(
    deviceContext: DeviceContext,
    task: ( executor: Executor ) => Promise<T>,
    options?: ExecutorOptions
  ): Promise<T> {

    const encoder = webgpu.deviceCreateCommandEncoder( deviceContext.device, { label: 'the encoder' } );
    const bufferLogger = new BufferLogger( deviceContext );

    const executor = new Executor(
      deviceContext,
      encoder,
      bufferLogger,
      options
    );

    const logBuffer = options?.logBuffer || null;

    // TODO: staging ring for our "out" buffers?
    const outputPromise = task( executor );

    const logPromise = logBuffer ? executor.arrayBuffer( logBuffer ) : Promise.resolve( null );

    const commandBuffer = webgpu.encoderFinish( encoder );
    webgpu.deviceQueueSubmit( deviceContext.device, [ commandBuffer ] );

    await bufferLogger.complete();

    const logResult = await logPromise;

    if ( logResult ) {
      const data = new Uint32Array( logResult );
      const length = data[ 0 ];
      const usedMessage = `logging used ${length} of ${data.length - 1} u32s (${roundSymmetric( 100 * length / ( data.length - 1 ) )}%)`;
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

    return outputPromise;
  }
}
alpenglow.register( 'Executor', Executor );