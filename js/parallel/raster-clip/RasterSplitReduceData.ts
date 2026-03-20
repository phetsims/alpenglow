// Copyright 2023-2026, University of Colorado Boulder

/**
 * A pair of counts (reducible/complete).
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import { alpenglow } from '../../alpenglow.js';
import type { ByteEncoder } from '../../webgpu/compute/ByteEncoder.js';
import type { RasterEdgeClip } from './RasterEdgeClip.js';
import type { RasterClippedChunk } from './RasterClippedChunk.js';

export class RasterSplitReduceData {
  public constructor(
    public readonly numReducible: number,
    public readonly numComplete: number
  ) {}

  public toString(): string {
    if ( isNaN( this.numReducible ) ) {
      return 'RasterSplitReduceData[INDETERMINATE]';
    }
    return `RasterSplitReduceData[reduce:${this.numReducible} complete:${this.numComplete}]`;
  }

  public static readonly ENCODING_BYTE_LENGTH = 4 * 2;

  public writeEncoding( encoder: ByteEncoder ): void {
    encoder.pushU32( this.numReducible );
    encoder.pushU32( this.numComplete );
  }

  public static readEncoding( arrayBuffer: ArrayBuffer, byteOffset: number ): RasterSplitReduceData {
    const uintBuffer = new Uint32Array( arrayBuffer, byteOffset, RasterSplitReduceData.ENCODING_BYTE_LENGTH / 4 );

    return new RasterSplitReduceData(
      uintBuffer[ 0 ],
      uintBuffer[ 1 ]
    );
  }

  public static fromArrayBuffer( arrayBuffer: ArrayBuffer ): RasterSplitReduceData[] {
    assert && assert( arrayBuffer.byteLength % RasterSplitReduceData.ENCODING_BYTE_LENGTH === 0 );

    return _.range( 0, arrayBuffer.byteLength / RasterSplitReduceData.ENCODING_BYTE_LENGTH ).map( i => {
      return RasterSplitReduceData.readEncoding( arrayBuffer, i * RasterSplitReduceData.ENCODING_BYTE_LENGTH );
    } );
  }

  public static combine( a: RasterSplitReduceData, b: RasterSplitReduceData ): RasterSplitReduceData {
    return new RasterSplitReduceData(
      a.numReducible + b.numReducible,
      a.numComplete + b.numComplete
    );
  }

  public static from( edgeClip: RasterEdgeClip, clippedChunk: RasterClippedChunk, exists: boolean ): RasterSplitReduceData {
    const isReducible = clippedChunk.isReducible;
    const count = exists ? edgeClip.getCount() : 0;

    return new RasterSplitReduceData(
      isReducible ? count : 0,
      clippedChunk.isExportingCompleteEdges() ? count : 0
    );
  }

  public static readonly INDETERMINATE = new RasterSplitReduceData(
    NaN, NaN
  );

  public static readonly IDENTITY = new RasterSplitReduceData(
    0, 0
  );
}

alpenglow.register( 'RasterSplitReduceData', RasterSplitReduceData );