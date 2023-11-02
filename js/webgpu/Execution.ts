// Copyright 2023, University of Colorado Boulder

/**
 * Helper object for common execution patterns. See methods on DeviceContext for details.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BufferLogger, DeviceContext } from '../imports.js';

export type ExecutionSingleCallback<T> = ( encoder: GPUCommandEncoder, execution: Execution ) => Promise<T>;
export type ExecutionMultipleCallback<T extends Record<string, Promise<unknown>>> = ( encoder: GPUCommandEncoder, execution: Execution ) => T;
export type Unpromised<T extends Record<string, Promise<unknown>>> = { [ K in keyof T ]: T[ K ] extends Promise<infer U> ? U : T[ K ] };

export default class Execution {

  public readonly bufferLogger: BufferLogger;
  public readonly encoder: GPUCommandEncoder;

  private buffersToCleanup: GPUBuffer[] = [];

  public constructor(
    public readonly deviceContext: DeviceContext
  ) {
    this.bufferLogger = new BufferLogger( deviceContext );
    this.encoder = deviceContext.device.createCommandEncoder( { label: 'the encoder' } );
  }

  public createBuffer( size: number ): GPUBuffer {
    const buffer = this.deviceContext.createBuffer( size );
    this.buffersToCleanup.push( buffer );
    return buffer;
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

  public async executeSingle<T>(
    callback: ExecutionSingleCallback<T>
  ): Promise<T> {
    const promise = callback( this.encoder, this );

    const commandBuffer = this.encoder.finish();
    this.deviceContext.device.queue.submit( [ commandBuffer ] );
    await this.bufferLogger.complete();

    this.buffersToCleanup.forEach( buffer => buffer.destroy() );

    return promise;
  }

  public async execute<T extends Record<string, Promise<unknown>>>(
    callback: ExecutionMultipleCallback<T>
  ): Promise<Unpromised<T>> {
    const promise = callback( this.encoder, this );

    const commandBuffer = this.encoder.finish();
    this.deviceContext.device.queue.submit( [ commandBuffer ] );
    await this.bufferLogger.complete();

    this.buffersToCleanup.forEach( buffer => buffer.destroy() );

    const result: Partial<Unpromised<T>> = {};
    for ( const key in promise ) {
      // @ts-expect-error Is there a way to get this to type check?
      result[ key ] = await promise[ key ];
    }

    return result as Unpromised<T>;
  }
}

alpenglow.register( 'Execution', Execution );
