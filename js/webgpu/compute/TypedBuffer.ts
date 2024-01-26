// Copyright 2023-2024, University of Colorado Boulder

/**
 * A GPUBuffer that is typed to a specific type, and can be used to encode/decode values to/from it.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BufferLogger, ByteEncoder, ConcreteType, DeviceContext, getArrayType, webgpu } from '../../imports.js';

export default class TypedBuffer<T = unknown> {
  public constructor(
    public readonly buffer: GPUBuffer,
    public readonly type: ConcreteType<T>
  ) {}

  public setValue( device: GPUDevice, value: T ): void {
    const encoder = new ByteEncoder();
    this.type.encode( value, encoder );
    webgpu.deviceWriteBuffer( device, this.buffer, 0, encoder.fullArrayBuffer, 0, encoder.byteLength );
  }

  public async getValue( encoder: GPUCommandEncoder, bufferLogger: BufferLogger ): Promise<T> {
    const arrayBuffer = await bufferLogger.arrayBuffer( encoder, this.buffer );

    return this.type.decode( new ByteEncoder( arrayBuffer ), 0 );
  }

  public dispose(): void {
    webgpu.bufferDestroy( this.buffer );
  }

  public static createArray<T>(
    deviceContext: DeviceContext,
    type: ConcreteType<T>,
    size: number,
    outOfRangeElement?: T
  ): TypedBuffer<T[]> {
    const buffer = deviceContext.createBuffer( size * type.bytesPerElement );
    return new TypedBuffer( buffer, getArrayType( type, size, outOfRangeElement ) );
  }

  public static createArrayFromData<T>(
    deviceContext: DeviceContext,
    type: ConcreteType<T>,
    data: T[]
  ): TypedBuffer<T[]> {
    const buffer = deviceContext.createBuffer( data.length * type.bytesPerElement );
    const typedBuffer = new TypedBuffer( buffer, getArrayType( type, data.length ) );
    typedBuffer.setValue( deviceContext.device, data );
    return typedBuffer;
  }

  public static wrapArray<T>(
    buffer: GPUBuffer,
    type: ConcreteType<T>,
    outOfRangeElement?: T,
    size = 0
  ): TypedBuffer<T[]> {
    if ( size === 0 ) {
      size = Math.floor( buffer.size / type.bytesPerElement );
    }

    return new TypedBuffer( buffer, getArrayType( type, size, outOfRangeElement ) );
  }
}

alpenglow.register( 'TypedBuffer', TypedBuffer );
