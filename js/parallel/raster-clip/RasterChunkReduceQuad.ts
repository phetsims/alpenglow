// Copyright 2023-2026, University of Colorado Boulder

/**
 * Represents an "applied interval" of reduce data, for both the min and max binary clips.
 *
 * In our segmented reduction, at each level we need to track intervals with the "fragments" of chunks' edges that
 * have not been completed yet.
 *
 * "left" means "the reduction of all values for the chunk index at the start of this interval"
 * "right" means "the reduction of all values for the chunk index at the end of this interval"
 *
 * Sometimes the left/right are equal (IFF they have the same chunk index).
 *
 * Each reduced data notes whether it contains the first/last edge of the chunk it references. Once we combine reduces
 * so that it contains both the first and last edge, we can "apply" it, moving the reduced data into the chunk.
 *
 * TODO: produce general documentation on this whole process.
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import { alpenglow } from '../../alpenglow.js';
import { RasterChunkReduceData } from './RasterChunkReduceData.js';
import type { ByteEncoder } from '../../webgpu/compute/ByteEncoder.js';

export class RasterChunkReduceQuad {
  public constructor(
    public leftMin: RasterChunkReduceData,
    public leftMax: RasterChunkReduceData,
    public rightMin: RasterChunkReduceData,
    public rightMax: RasterChunkReduceData
  ) {}

  public static combine( a: RasterChunkReduceQuad, b: RasterChunkReduceQuad ): RasterChunkReduceQuad {
    return new RasterChunkReduceQuad(
      // We need separate logic for the "left" combine, due to the combine "taking" the right side
      a.leftMin.clippedChunkIndex === b.leftMin.clippedChunkIndex ? RasterChunkReduceData.combine( a.leftMin, b.leftMin ) : a.leftMin,
      a.leftMax.clippedChunkIndex === b.leftMax.clippedChunkIndex ? RasterChunkReduceData.combine( a.leftMax, b.leftMax ) : a.leftMax,
      RasterChunkReduceData.combine( a.rightMin, b.rightMin ),
      RasterChunkReduceData.combine( a.rightMax, b.rightMax )
    );
  }

  public toStrings(): string[] {
    return [
      `leftMin: ${this.leftMin.toString()}`,
      `rightMin: ${this.rightMin.toString()}`,
      `leftMax: ${this.leftMax.toString()}`,
      `rightMax: ${this.rightMax.toString()}`
    ];
  }

  public static readonly ENCODING_BYTE_LENGTH = 4 * RasterChunkReduceData.ENCODING_BYTE_LENGTH;

  public writeEncoding( encoder: ByteEncoder ): void {
    this.leftMin.writeEncoding( encoder );
    this.leftMax.writeEncoding( encoder );
    this.rightMin.writeEncoding( encoder );
    this.rightMax.writeEncoding( encoder );
  }

  public static readEncoding( arrayBuffer: ArrayBuffer, byteOffset: number ): RasterChunkReduceQuad {
    return new RasterChunkReduceQuad(
      RasterChunkReduceData.readEncoding( arrayBuffer, byteOffset ),
      RasterChunkReduceData.readEncoding( arrayBuffer, byteOffset + RasterChunkReduceData.ENCODING_BYTE_LENGTH ),
      RasterChunkReduceData.readEncoding( arrayBuffer, byteOffset + 2 * RasterChunkReduceData.ENCODING_BYTE_LENGTH ),
      RasterChunkReduceData.readEncoding( arrayBuffer, byteOffset + 3 * RasterChunkReduceData.ENCODING_BYTE_LENGTH )
    );
  }

  public static fromArrayBuffer( arrayBuffer: ArrayBuffer ): RasterChunkReduceQuad[] {
    assert && assert( arrayBuffer.byteLength % RasterChunkReduceQuad.ENCODING_BYTE_LENGTH === 0 );

    return _.range( 0, arrayBuffer.byteLength / RasterChunkReduceQuad.ENCODING_BYTE_LENGTH ).map( i => {
      return RasterChunkReduceQuad.readEncoding( arrayBuffer, i * RasterChunkReduceQuad.ENCODING_BYTE_LENGTH );
    } );
  }

  public static readonly INDETERMINATE = new RasterChunkReduceQuad(
    RasterChunkReduceData.INDETERMINATE,
    RasterChunkReduceData.INDETERMINATE,
    RasterChunkReduceData.INDETERMINATE,
    RasterChunkReduceData.INDETERMINATE
  );

  public static readonly OUT_OF_RANGE = new RasterChunkReduceQuad(
    RasterChunkReduceData.OUT_OF_RANGE,
    RasterChunkReduceData.OUT_OF_RANGE,
    RasterChunkReduceData.OUT_OF_RANGE,
    RasterChunkReduceData.OUT_OF_RANGE
  );
}

alpenglow.register( 'RasterChunkReduceQuad', RasterChunkReduceQuad );