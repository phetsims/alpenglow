// Copyright 2023-2025, University of Colorado Boulder

/**
 * Like RasterChunkReduceQuad, but for the initial case where our left/right values are the same, and we can do a
 * slightly different optimized reduce.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow } from '../../alpenglow.js';
import { RasterChunkReduceData } from './RasterChunkReduceData.js';
import type { ByteEncoder } from '../../webgpu/compute/ByteEncoder.js';

export class RasterChunkReducePair {
  public constructor(
    public min: RasterChunkReduceData,
    public max: RasterChunkReduceData
  ) {
    assert && assert( min.isFirstEdge === max.isFirstEdge );
    assert && assert( min.isLastEdge === max.isLastEdge );
    assert && assert( isFinite( min.clippedChunkIndex ) && min.clippedChunkIndex > 0 ? (
      min.clippedChunkIndex + 1 === max.clippedChunkIndex
    ) : true );
  }

  public isFirstEdge(): boolean {
    return this.min.isFirstEdge;
  }

  public isLastEdge(): boolean {
    return this.min.isLastEdge;
  }

  public static combine( a: RasterChunkReducePair, b: RasterChunkReducePair ): RasterChunkReducePair {
    return new RasterChunkReducePair(
      RasterChunkReduceData.combine( a.min, b.min ),
      RasterChunkReduceData.combine( a.max, b.max )
    );
  }

  public toStrings(): string[] {
    return [
      `min: ${this.min.toString()}`,
      `max: ${this.max.toString()}`
    ];
  }

  public static readonly ENCODING_BYTE_LENGTH = 2 * RasterChunkReduceData.ENCODING_BYTE_LENGTH;

  public writeEncoding( encoder: ByteEncoder ): void {
    this.min.writeEncoding( encoder );
    this.max.writeEncoding( encoder );
  }

  public static readEncoding( arrayBuffer: ArrayBuffer, byteOffset: number ): RasterChunkReducePair {
    return new RasterChunkReducePair(
      RasterChunkReduceData.readEncoding( arrayBuffer, byteOffset ),
      RasterChunkReduceData.readEncoding( arrayBuffer, byteOffset + RasterChunkReduceData.ENCODING_BYTE_LENGTH )
    );
  }

  public static fromArrayBuffer( arrayBuffer: ArrayBuffer ): RasterChunkReducePair[] {
    assert && assert( arrayBuffer.byteLength % RasterChunkReducePair.ENCODING_BYTE_LENGTH === 0 );

    return _.range( 0, arrayBuffer.byteLength / RasterChunkReducePair.ENCODING_BYTE_LENGTH ).map( i => {
      return RasterChunkReducePair.readEncoding( arrayBuffer, i * RasterChunkReducePair.ENCODING_BYTE_LENGTH );
    } );
  }

  public static readonly INDETERMINATE = new RasterChunkReducePair(
    RasterChunkReduceData.INDETERMINATE,
    RasterChunkReduceData.INDETERMINATE
  );

  public static readonly OUT_OF_RANGE = new RasterChunkReducePair(
    RasterChunkReduceData.OUT_OF_RANGE,
    RasterChunkReduceData.OUT_OF_RANGE
  );
}

alpenglow.register( 'RasterChunkReducePair', RasterChunkReducePair );