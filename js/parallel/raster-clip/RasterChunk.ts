// Copyright 2023-2024, University of Colorado Boulder

/**
 * Contains path data within a bounds, for a particular RenderProgram
 *
 * Used for the raster-clip input, and the output for reducible chunks (that will be fed back in)
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow } from '../../alpenglow.js';
import type { ByteEncoder } from '../../webgpu/compute/ByteEncoder.js';
import type { ParallelStorageArray } from '../ParallelStorageArray.js';
import type { RasterEdge } from './RasterEdge.js';

export class RasterChunk {
  public constructor(
    public readonly renderProgramIndex: number,
    public readonly needsFace: boolean,
    public readonly isConstant: boolean,

    // TODO: why this parameter order? fix?
    public readonly edgesOffset: number,
    public readonly numEdges: number,

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

  public withEdgeInfo( startIndex: number, endIndex: number ): RasterChunk {
    return new RasterChunk(
      this.renderProgramIndex,
      this.needsFace,
      this.isConstant,
      startIndex,
      endIndex - startIndex,
      this.minX, this.minY, this.maxX, this.maxY,
      this.minXCount, this.minYCount, this.maxXCount, this.maxYCount
    );
  }

  public toString(): string {
    if ( isNaN( this.renderProgramIndex ) ) {
      return 'RasterChunk[INDETERMINATE]';
    }
    const counts = `counts:${this.minXCount},${this.minYCount},${this.maxXCount},${this.maxYCount}`;
    const bounds = `bounds:x[${this.minX},${this.maxX}],y[${this.minY},${this.maxY}]`;
    const needs = this.needsFace ? ' needsFace' : '';
    return `RasterChunk[prog:${this.renderProgramIndex} ${counts} ${bounds} numEdges:${this.numEdges} edgesOffset:${this.edgesOffset}${needs}]`;
  }

  public static readonly ENCODING_BYTE_LENGTH = 4 * 11;

  public writeEncoding( encoder: ByteEncoder ): void {
    assert && assert( this.renderProgramIndex >= 0 && this.renderProgramIndex <= 0x00ffffff );

    encoder.pushU32(
      ( this.renderProgramIndex & 0x00ffffff ) | ( this.needsFace ? 0x40000000 : 0 ) | ( this.isConstant ? 0x80000000 : 0 )
    );
    encoder.pushU32( this.edgesOffset );
    encoder.pushU32( this.numEdges );

    encoder.pushF32( this.minX );
    encoder.pushF32( this.minY );
    encoder.pushF32( this.maxX );
    encoder.pushF32( this.maxY );

    encoder.pushI32( this.minXCount );
    encoder.pushI32( this.minYCount );
    encoder.pushI32( this.maxXCount );
    encoder.pushI32( this.maxYCount );
  }

  public static readEncoding( arrayBuffer: ArrayBuffer, byteOffset: number ): RasterChunk {
    const uintBuffer = new Uint32Array( arrayBuffer, byteOffset, RasterChunk.ENCODING_BYTE_LENGTH / 4 );
    const intBuffer = new Int32Array( arrayBuffer, byteOffset, RasterChunk.ENCODING_BYTE_LENGTH / 4 );
    const floatBuffer = new Float32Array( arrayBuffer, byteOffset, RasterChunk.ENCODING_BYTE_LENGTH / 4 );

    const renderProgramIndex = uintBuffer[ 0 ] & 0x00ffffff;
    const needsFace = ( uintBuffer[ 0 ] & 0x40000000 ) !== 0;
    const isConstant = ( uintBuffer[ 0 ] & 0x80000000 ) !== 0;

    return new RasterChunk(
      renderProgramIndex,
      needsFace,
      isConstant,

      uintBuffer[ 1 ],
      uintBuffer[ 2 ],

      floatBuffer[ 3 ],
      floatBuffer[ 4 ],
      floatBuffer[ 5 ],
      floatBuffer[ 6 ],

      intBuffer[ 7 ],
      intBuffer[ 8 ],
      intBuffer[ 9 ],
      intBuffer[ 10 ]
    );
  }

  public static fromArrayBuffer( arrayBuffer: ArrayBuffer ): RasterChunk[] {
    assert && assert( arrayBuffer.byteLength % RasterChunk.ENCODING_BYTE_LENGTH === 0 );

    return _.range( 0, arrayBuffer.byteLength / RasterChunk.ENCODING_BYTE_LENGTH ).map( i => {
      return RasterChunk.readEncoding( arrayBuffer, i * RasterChunk.ENCODING_BYTE_LENGTH );
    } );
  }

  public static readonly INDETERMINATE = new RasterChunk(
    NaN, false, false, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN
  );

  public static validate(
    chunks: ParallelStorageArray<RasterChunk>,
    edges: ParallelStorageArray<RasterEdge>,
    numChunks: number,
    numEdges: number
  ): void {
    if ( assert ) {
      assert( isFinite( numChunks ) && numChunks >= 0 );
      assert( isFinite( numEdges ) && numEdges >= 0 );
      assert( numChunks <= chunks.data.length );
      assert( numEdges <= edges.data.length );

      for ( let i = 0; i < numChunks; i++ ) {
        const chunk = chunks.data[ i ];

        assert( isFinite( chunk.renderProgramIndex ) );
        assert( chunk.minX <= chunk.maxX );
        assert( chunk.minY <= chunk.maxY );

        assert( isFinite( chunk.minXCount ) );
        assert( isFinite( chunk.minYCount ) );
        assert( isFinite( chunk.maxXCount ) );
        assert( isFinite( chunk.maxYCount ) );

        assert( Math.abs( chunk.minXCount ) <= 1, 'Hypothesis' );
        assert( Math.abs( chunk.minYCount ) <= 1, 'Hypothesis' );
        assert( Math.abs( chunk.maxXCount ) <= 1, 'Hypothesis' );
        assert( Math.abs( chunk.maxYCount ) <= 1, 'Hypothesis' );

        if ( chunk.numEdges ) {
          assert( chunk.edgesOffset >= 0 );
          assert( chunk.edgesOffset + chunk.numEdges <= numEdges );

          for ( let j = 0; j < chunk.numEdges; j++ ) {
            const edge = edges.data[ chunk.edgesOffset + j ];

            assert( edge.chunkIndex === i );
            assert( edge.isFirstEdge === ( j === 0 ) );
            assert( edge.isLastEdge === ( j === chunk.numEdges - 1 ) );
            assert( edge.startPoint.isFinite() );
            assert( edge.endPoint.isFinite() );
          }
        }
      }
    }
  }
}

alpenglow.register( 'RasterChunk', RasterChunk );