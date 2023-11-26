// Copyright 2023, University of Colorado Boulder

/**
 * A GPUBuffer that is typed to a specific type, and can be used to encode/decode values to/from it.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BufferLogger, ByteEncoder, ConcreteType, getArrayType } from '../imports.js';

export default class TypedBuffer<T> {
  public constructor(
    public readonly buffer: GPUBuffer,
    public readonly type: ConcreteType<T>
  ) {}

  public setValue( device: GPUDevice, value: T ): void {
    const encoder = new ByteEncoder();
    this.type.encode( value, encoder );
    device.queue.writeBuffer( this.buffer, 0, encoder.fullArrayBuffer, 0, encoder.fullArrayBuffer.byteLength );
  }

  public async getValue( encoder: GPUCommandEncoder, bufferLogger: BufferLogger ): Promise<T> {
    const arrayBuffer = await bufferLogger.arrayBuffer( encoder, this.buffer );

    return this.type.decode( new ByteEncoder( arrayBuffer ), 0 );
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
