// Copyright 2023-2024, University of Colorado Boulder

/**
 * Output chunk for the raster-clip algorithm
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, ByteEncoder, ParallelStorageArray, RasterCompleteEdge } from '../../imports.js';

export default class RasterCompleteChunk {
  public constructor(
    public readonly renderProgramIndex: number,

    public readonly edgesOffset: number,
    public readonly numEdges: number,
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

  public withEdgeInfo( startIndex: number, endIndex: number ): RasterCompleteChunk {
    return new RasterCompleteChunk(
      this.renderProgramIndex,
      this.isFullArea ? 0 : startIndex,
      this.isFullArea ? 0 : endIndex - startIndex,
      this.isFullArea,
      this.area,
      this.minX, this.minY, this.maxX, this.maxY,
      this.isFullArea ? -1 : this.minXCount,
      this.isFullArea ? 1 : this.minYCount,
      this.isFullArea ? 1 : this.maxXCount,
      this.isFullArea ? -1 : this.maxYCount
    );
  }

  public toString(): string {
    if ( isNaN( this.renderProgramIndex ) ) {
      return 'RasterCompleteChunk[INDETERMINATE]';
    }
    const counts = `counts:${this.minXCount},${this.minYCount},${this.maxXCount},${this.maxYCount}`;
    const bounds = `bounds:x[${this.minX},${this.maxX}],y[${this.minY},${this.maxY}]`;
    const area = `area:${this.area}`;
    const isFullArea = this.isFullArea ? ' fullArea' : '';
    return `RasterCompleteChunk[prog:${this.renderProgramIndex} ${counts} ${bounds} numEdges:${this.numEdges} edgesOffset:${this.edgesOffset} ${area}${isFullArea}]`;
  }

  public static readonly ENCODING_BYTE_LENGTH = 4 * 12;

  public writeEncoding( encoder: ByteEncoder ): void {
    assert && assert( this.renderProgramIndex >= 0 && this.renderProgramIndex <= 0x00ffffff );

    encoder.pushU32(
      ( this.renderProgramIndex & 0x00ffffff ) |
      ( this.isFullArea ? 0x20000000 : 0 )
    );
    encoder.pushU32( this.edgesOffset );
    encoder.pushU32( this.numEdges );
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

  public static readEncoding( arrayBuffer: ArrayBuffer, byteOffset: number ): RasterCompleteChunk {
    const uintBuffer = new Uint32Array( arrayBuffer, byteOffset, RasterCompleteChunk.ENCODING_BYTE_LENGTH / 4 );
    const intBuffer = new Int32Array( arrayBuffer, byteOffset, RasterCompleteChunk.ENCODING_BYTE_LENGTH / 4 );
    const floatBuffer = new Float32Array( arrayBuffer, byteOffset, RasterCompleteChunk.ENCODING_BYTE_LENGTH / 4 );

    const renderProgramIndex = uintBuffer[ 0 ] & 0x00ffffff;
    const isFullArea = ( uintBuffer[ 0 ] & 0x20000000 ) !== 0;

    return new RasterCompleteChunk(
      renderProgramIndex,

      uintBuffer[ 1 ],
      uintBuffer[ 2 ],
      isFullArea,
      floatBuffer[ 3 ],

      floatBuffer[ 4 ],
      floatBuffer[ 5 ],
      floatBuffer[ 6 ],
      floatBuffer[ 7 ],

      intBuffer[ 8 ],
      intBuffer[ 9 ],
      intBuffer[ 10 ],
      intBuffer[ 11 ]
    );
  }

  public static fromArrayBuffer( arrayBuffer: ArrayBuffer ): RasterCompleteChunk[] {
    assert && assert( arrayBuffer.byteLength % RasterCompleteChunk.ENCODING_BYTE_LENGTH === 0 );

    return _.range( 0, arrayBuffer.byteLength / RasterCompleteChunk.ENCODING_BYTE_LENGTH ).map( i => {
      return RasterCompleteChunk.readEncoding( arrayBuffer, i * RasterCompleteChunk.ENCODING_BYTE_LENGTH );
    } );
  }

  public static readonly INDETERMINATE = new RasterCompleteChunk(
    NaN, NaN, NaN, false, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN
  );

  public static validate(
    chunks: ParallelStorageArray<RasterCompleteChunk>,
    edges: ParallelStorageArray<RasterCompleteEdge>,
    numChunks: number,
    numEdges: number
  ): void {
    if ( assert ) {
      assert( isFinite( numChunks ) && numChunks >= 0 );
      assert( isFinite( numEdges ) && numEdges >= 0 );
      assert( numChunks <= chunks.data.length );
      assert( numEdges <= edges.data.length );

      const usedIndices = new Set<number>();

      for ( let i = 0; i < numChunks; i++ ) {
        const chunk = chunks.data[ i ];

        assert( isFinite( chunk.renderProgramIndex ) );
        assert( chunk.minX <= chunk.maxX );
        assert( chunk.minY <= chunk.maxY );
        assert( isFinite( chunk.area ) );
        assert( chunk.area > 0 );

        if ( chunk.isFullArea ) {
          assert( chunk.numEdges === 0 );
          assert( chunk.minXCount !== 0 );
          assert( chunk.minYCount !== 0 );
          assert( chunk.maxXCount !== 0 );
          assert( chunk.maxYCount !== 0 );
        }
        else {
          // assert(
          //   chunk.numEdges > 0 ||
          //   chunk.minXCount !== 0 ||
          //   chunk.minYCount !== 0 ||
          //   chunk.maxXCount !== 0 ||
          //   chunk.maxYCount !== 0
          // );
        }

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
            const index = chunk.edgesOffset + j;
            const edge = edges.data[ index ];

            assert( !usedIndices.has( index ) );
            usedIndices.add( index );

            assert( edge.startPoint.isFinite() );
            assert( edge.endPoint.isFinite() );
          }
        }
      }
    }
  }
}

alpenglow.register( 'RasterCompleteChunk', RasterCompleteChunk );