// Copyright 2023-2025, University of Colorado Boulder

/**
 * Represents an edge from a RasterChunk
 *
 * Used for the raster-clip input, and the output for reducible edges (that will be fed back in)
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import Vector2 from '../../../../dot/js/Vector2.js';
import { alpenglow } from '../../alpenglow.js';
import type { ByteEncoder } from '../../webgpu/compute/ByteEncoder.js';

export class RasterEdge {
  public constructor(
    public readonly chunkIndex: number,
    public readonly isFirstEdge: boolean,
    public readonly isLastEdge: boolean,
    public readonly startPoint: Vector2,
    public readonly endPoint: Vector2
  ) {}

  public toString(): string {
    if ( isNaN( this.chunkIndex ) ) {
      return 'RasterEdge[INDETERMINATE]';
    }
    const firstLast = this.isFirstEdge ? ( this.isLastEdge ? ' BOTH' : ' FIRST' ) : ( this.isLastEdge ? ' LAST' : '' );
    return `RasterEdge[chunk:${this.chunkIndex} ${this.startPoint.x},${this.startPoint.y} => ${this.endPoint.x},${this.endPoint.y}${firstLast}]`;
  }

  public static readonly ENCODING_BYTE_LENGTH = 4 * 5;

  public writeEncoding( encoder: ByteEncoder ): void {
    assert && assert( this.chunkIndex >= 0 && this.chunkIndex <= 0x2fffffff );

    encoder.pushU32(
      ( this.chunkIndex & 0x2fffffff ) |
      ( this.isFirstEdge ? 0x40000000 : 0 ) |
      ( this.isLastEdge ? 0x80000000 : 0 )
    );
    encoder.pushF32( this.startPoint.x );
    encoder.pushF32( this.startPoint.y );
    encoder.pushF32( this.endPoint.x );
    encoder.pushF32( this.endPoint.y );
  }

  public static readEncoding( arrayBuffer: ArrayBuffer, byteOffset: number ): RasterEdge {
    const uintBuffer = new Uint32Array( arrayBuffer, byteOffset, RasterEdge.ENCODING_BYTE_LENGTH / 4 );
    const floatBuffer = new Float32Array( arrayBuffer, byteOffset, RasterEdge.ENCODING_BYTE_LENGTH / 4 );

    const chunkIndex = uintBuffer[ 0 ] & 0x2fffffff;
    const isFirstEdge = ( uintBuffer[ 0 ] & 0x40000000 ) !== 0;
    const isLastEdge = ( uintBuffer[ 0 ] & 0x80000000 ) !== 0;

    return new RasterEdge(
      chunkIndex,
      isFirstEdge,
      isLastEdge,
      new Vector2( floatBuffer[ 1 ], floatBuffer[ 2 ] ),
      new Vector2( floatBuffer[ 3 ], floatBuffer[ 4 ] )
    );
  }

  public static fromArrayBuffer( arrayBuffer: ArrayBuffer ): RasterEdge[] {
    assert && assert( arrayBuffer.byteLength % RasterEdge.ENCODING_BYTE_LENGTH === 0 );

    return _.range( 0, arrayBuffer.byteLength / RasterEdge.ENCODING_BYTE_LENGTH ).map( i => {
      return RasterEdge.readEncoding( arrayBuffer, i * RasterEdge.ENCODING_BYTE_LENGTH );
    } );
  }

  public static readonly INDETERMINATE = new RasterEdge(
    NaN, false, false, new Vector2( NaN, NaN ), new Vector2( NaN, NaN )
  );
}

alpenglow.register( 'RasterEdge', RasterEdge );