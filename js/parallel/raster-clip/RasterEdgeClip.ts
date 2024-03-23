// Copyright 2023-2024, University of Colorado Boulder

/**
 * Represents the clipped state of a RasterEdge. For the binary version, there will be two of these edge clips per
 * input edge.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, ByteEncoder } from '../../imports.js';
import Vector2 from '../../../../dot/js/Vector2.js';

export default class RasterEdgeClip {
  public constructor(
    public readonly clippedChunkIndex: number,

    public readonly point0: Vector2,
    public readonly point1: Vector2,
    public readonly point2: Vector2,
    public readonly point3: Vector2,

    public readonly isFirstEdge: boolean,
    public readonly isLastEdge: boolean
  ) {}

  public getCount(): number {
    return ( this.point0.equals( this.point1 ) ? 0 : 1 ) +
           ( this.point1.equals( this.point2 ) ? 0 : 1 ) +
           ( this.point2.equals( this.point3 ) ? 0 : 1 );
  }

  public getArea(): number {
    return 0.5 * (
      ( this.point1.x + this.point0.x ) * ( this.point1.y - this.point0.y ) +
      ( this.point2.x + this.point1.x ) * ( this.point2.y - this.point1.y ) +
      ( this.point3.x + this.point2.x ) * ( this.point3.y - this.point2.y )
    );
  }

  public toString(): string {
    if ( isNaN( this.clippedChunkIndex ) ) {
      return 'RasterEdgeClip[INDETERMINATE]';
    }
    const firstLast = this.isFirstEdge ? ( this.isLastEdge ? ' BOTH' : ' FIRST' ) : ( this.isLastEdge ? ' LAST' : '' );
    const coords = `${this.point0.x},${this.point0.y} => ${this.point1.x},${this.point1.y} => ${this.point2.x},${this.point2.y} => ${this.point3.x},${this.point3.y}`;
    return `RasterEdgeClip[clippedChunk:${this.clippedChunkIndex} ${coords}${firstLast}]`;
  }

  public static readonly ENCODING_BYTE_LENGTH = 4 * 9;

  public writeEncoding( encoder: ByteEncoder ): void {
    assert && assert( this.clippedChunkIndex >= 0 && this.clippedChunkIndex <= 0x2fffffff );

    encoder.pushU32(
      ( this.clippedChunkIndex & 0x2fffffff ) |
      ( this.isFirstEdge ? 0x40000000 : 0 ) |
      ( this.isLastEdge ? 0x80000000 : 0 )
    );
    encoder.pushF32( this.point0.x );
    encoder.pushF32( this.point0.y );
    encoder.pushF32( this.point1.x );
    encoder.pushF32( this.point1.y );
    encoder.pushF32( this.point2.x );
    encoder.pushF32( this.point2.y );
    encoder.pushF32( this.point3.x );
    encoder.pushF32( this.point3.y );
  }

  public static readEncoding( arrayBuffer: ArrayBuffer, byteOffset: number ): RasterEdgeClip {
    const uintBuffer = new Uint32Array( arrayBuffer, byteOffset, RasterEdgeClip.ENCODING_BYTE_LENGTH / 4 );
    const floatBuffer = new Float32Array( arrayBuffer, byteOffset, RasterEdgeClip.ENCODING_BYTE_LENGTH / 4 );

    const clippedChunkIndex = uintBuffer[ 0 ] & 0x2fffffff;
    const isFirstEdge = ( uintBuffer[ 0 ] & 0x40000000 ) !== 0;
    const isLastEdge = ( uintBuffer[ 0 ] & 0x80000000 ) !== 0;

    return new RasterEdgeClip(
      clippedChunkIndex,
      new Vector2( floatBuffer[ 1 ], floatBuffer[ 2 ] ),
      new Vector2( floatBuffer[ 3 ], floatBuffer[ 4 ] ),
      new Vector2( floatBuffer[ 5 ], floatBuffer[ 6 ] ),
      new Vector2( floatBuffer[ 7 ], floatBuffer[ 8 ] ),
      isFirstEdge,
      isLastEdge
    );
  }

  public static fromArrayBuffer( arrayBuffer: ArrayBuffer ): RasterEdgeClip[] {
    assert && assert( arrayBuffer.byteLength % RasterEdgeClip.ENCODING_BYTE_LENGTH === 0 );

    return _.range( 0, arrayBuffer.byteLength / RasterEdgeClip.ENCODING_BYTE_LENGTH ).map( i => {
      return RasterEdgeClip.readEncoding( arrayBuffer, i * RasterEdgeClip.ENCODING_BYTE_LENGTH );
    } );
  }

  public static readonly INDETERMINATE = new RasterEdgeClip(
    NaN,
    new Vector2( NaN, NaN ),
    new Vector2( NaN, NaN ),
    new Vector2( NaN, NaN ),
    new Vector2( NaN, NaN ),
    false,
    false
  );
}

alpenglow.register( 'RasterEdgeClip', RasterEdgeClip );