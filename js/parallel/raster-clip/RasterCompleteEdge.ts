// Copyright 2023-2024, University of Colorado Boulder

/**
 * Represents an edge from a RasterCompleteEdgeChunk
 *
 * Output edge for the raster-clip algorithm
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import Vector2 from '../../../../dot/js/Vector2.js';
import { alpenglow, ByteEncoder } from '../../imports.js';

export default class RasterCompleteEdge {
  public constructor(
    public readonly startPoint: Vector2,
    public readonly endPoint: Vector2
  ) {}

  public toString(): string {
    if ( isNaN( this.startPoint.x ) ) {
      return 'RasterCompleteEdge[INDETERMINATE]';
    }
    return `RasterCompleteEdge[${this.startPoint.x},${this.startPoint.y} => ${this.endPoint.x},${this.endPoint.y}]`;
  }

  public static readonly ENCODING_BYTE_LENGTH = 4 * 4;

  public writeEncoding( encoder: ByteEncoder ): void {
    encoder.pushF32( this.startPoint.x );
    encoder.pushF32( this.startPoint.y );
    encoder.pushF32( this.endPoint.x );
    encoder.pushF32( this.endPoint.y );
  }

  public static readEncoding( arrayBuffer: ArrayBuffer, byteOffset: number ): RasterCompleteEdge {
    const floatBuffer = new Float32Array( arrayBuffer, byteOffset, RasterCompleteEdge.ENCODING_BYTE_LENGTH / 4 );

    return new RasterCompleteEdge(
      new Vector2( floatBuffer[ 0 ], floatBuffer[ 1 ] ),
      new Vector2( floatBuffer[ 2 ], floatBuffer[ 3 ] )
    );
  }

  public static fromArrayBuffer( arrayBuffer: ArrayBuffer ): RasterCompleteEdge[] {
    assert && assert( arrayBuffer.byteLength % RasterCompleteEdge.ENCODING_BYTE_LENGTH === 0 );

    return _.range( 0, arrayBuffer.byteLength / RasterCompleteEdge.ENCODING_BYTE_LENGTH ).map( i => {
      return RasterCompleteEdge.readEncoding( arrayBuffer, i * RasterCompleteEdge.ENCODING_BYTE_LENGTH );
    } );
  }

  public static readonly INDETERMINATE = new RasterCompleteEdge(
    new Vector2( NaN, NaN ), new Vector2( NaN, NaN )
  );
}

alpenglow.register( 'RasterCompleteEdge', RasterCompleteEdge );