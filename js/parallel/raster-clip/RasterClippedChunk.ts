// Copyright 2023-2025, University of Colorado Boulder

/**
 * A clipped part of a RasterChunk, which will get filled with data during reduction.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow } from '../../alpenglow.js';
import { RasterSplitReduceData } from './RasterSplitReduceData.js';
import type { ByteEncoder } from '../../webgpu/compute/ByteEncoder.js';

export class RasterClippedChunk {
  public constructor(
    public readonly renderProgramIndex: number,
    public readonly needsFace: boolean,
    public readonly isConstant: boolean,

    // Filled in by early steps
    public readonly isReducible: boolean,
    public readonly isComplete: boolean,
    public readonly isFullArea: boolean,
    public readonly area: number,

    // Floating point (typically integral or offset by 0.5) bounds.
    public readonly minX: number,
    public readonly minY: number,
    public readonly maxX: number,
    public readonly maxY: number,

    // EdgedClipped counts. See EdgedClippedFace for details.
    public readonly minXCount: number,
    public readonly minYCount: number,
    public readonly maxXCount: number,
    public readonly maxYCount: number
  ) {}

  public needsCompleteOutputSplit(): boolean {
    return this.isComplete && this.isFullArea && !this.isConstant;
  }

  public outputSplitCount(): number {
    assert && assert( this.needsCompleteOutputSplit() );

    return ( this.maxX - this.minX ) * ( this.maxY - this.minY );
  }

  public getSplitReduceData(): RasterSplitReduceData {
    return new RasterSplitReduceData(
      this.isReducible ? 1 : 0,
      this.isComplete ? (
        this.needsCompleteOutputSplit() ? this.outputSplitCount() : 1
      ) : 0
    );
  }

  public isExportingCompleteEdges(): boolean {
    return this.isComplete && !this.isFullArea && this.needsFace;
  }

  public toString(): string {
    if ( isNaN( this.renderProgramIndex ) ) {
      return 'RasterClippedChunk[INDETERMINATE]';
    }
    const counts = `counts:${this.minXCount},${this.minYCount},${this.maxXCount},${this.maxYCount}`;
    const bounds = `bounds:x[${this.minX},${this.maxX}],y[${this.minY},${this.maxY}]`;
    const needs = this.needsFace ? ' needsFace' : '';
    const area = `area:${this.area}`;
    const reducible = this.isReducible ? ' reducible' : '';
    const contributing = this.isComplete ? ' complete' : '';
    const fullArea = this.isFullArea ? ' fullArea' : '';
    return `RasterClippedChunk[prog:${this.renderProgramIndex} ${counts} ${bounds} ${area}${reducible}${contributing}${fullArea}${needs}]`;
  }

  public static readonly ENCODING_BYTE_LENGTH = 4 * 10;

  public writeEncoding( encoder: ByteEncoder ): void {
    assert && assert( this.renderProgramIndex >= 0 && this.renderProgramIndex <= 0x00ffffff );

    encoder.pushU32(
      ( this.renderProgramIndex & 0x00ffffff ) |
      ( this.isReducible ? 0x08000000 : 0 ) |
      ( this.isComplete ? 0x10000000 : 0 ) |
      ( this.isFullArea ? 0x20000000 : 0 ) |
      ( this.needsFace ? 0x40000000 : 0 ) |
      ( this.isConstant ? 0x80000000 : 0 )
    );
    encoder.pushF32( this.area );

    encoder.pushF32( this.minX );
    encoder.pushF32( this.minY );
    encoder.pushF32( this.maxX );
    encoder.pushF32( this.maxY );

    encoder.pushI32( this.minXCount );
    encoder.pushI32( this.minYCount );
    encoder.pushI32( this.maxXCount );
    encoder.pushI32( this.maxYCount );
  }

  public static readEncoding( arrayBuffer: ArrayBuffer, byteOffset: number ): RasterClippedChunk {
    const uintBuffer = new Uint32Array( arrayBuffer, byteOffset, RasterClippedChunk.ENCODING_BYTE_LENGTH / 4 );
    const intBuffer = new Int32Array( arrayBuffer, byteOffset, RasterClippedChunk.ENCODING_BYTE_LENGTH / 4 );
    const floatBuffer = new Float32Array( arrayBuffer, byteOffset, RasterClippedChunk.ENCODING_BYTE_LENGTH / 4 );

    const renderProgramIndex = uintBuffer[ 0 ] & 0x00ffffff;
    const isReducible = ( uintBuffer[ 0 ] & 0x08000000 ) !== 0;
    const isComplete = ( uintBuffer[ 0 ] & 0x10000000 ) !== 0;
    const isFullArea = ( uintBuffer[ 0 ] & 0x20000000 ) !== 0;
    const needsFace = ( uintBuffer[ 0 ] & 0x40000000 ) !== 0;
    const isConstant = ( uintBuffer[ 0 ] & 0x80000000 ) !== 0;

    return new RasterClippedChunk(
      renderProgramIndex,
      needsFace,
      isConstant,

      isReducible,
      isComplete,
      isFullArea,

      floatBuffer[ 1 ],

      floatBuffer[ 2 ],
      floatBuffer[ 3 ],
      floatBuffer[ 4 ],
      floatBuffer[ 5 ],

      intBuffer[ 6 ],
      intBuffer[ 7 ],
      intBuffer[ 8 ],
      intBuffer[ 9 ]
    );
  }

  public static fromArrayBuffer( arrayBuffer: ArrayBuffer ): RasterClippedChunk[] {
    assert && assert( arrayBuffer.byteLength % RasterClippedChunk.ENCODING_BYTE_LENGTH === 0 );

    return _.range( 0, arrayBuffer.byteLength / RasterClippedChunk.ENCODING_BYTE_LENGTH ).map( i => {
      return RasterClippedChunk.readEncoding( arrayBuffer, i * RasterClippedChunk.ENCODING_BYTE_LENGTH );
    } );
  }

  public static readonly INDETERMINATE = new RasterClippedChunk(
    NaN, false, false, false, false, false, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN
  );

  public static readonly DISCARDABLE = new RasterClippedChunk(
    0, false, false, false, false, false, 0, 0, 0, 0, 0, 0, 0, 0, 0
  );
}

alpenglow.register( 'RasterClippedChunk', RasterClippedChunk );