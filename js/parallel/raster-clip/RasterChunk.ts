// Copyright 2023, University of Colorado Boulder

/**
 * Contains path data within a bounds, for a particular RenderProgram
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, ParallelStorageArray, RasterEdge } from '../../imports.js';

export default class RasterChunk {
  public constructor(
    public readonly rasterProgramIndex: number,
    public readonly needsFace: boolean,
    public readonly isConstant: boolean,

    public readonly edgesOffset: number,
    public readonly numEdges: number,

    // (Float?) bounds
    public readonly minX: number,
    public readonly minY: number,
    public readonly maxX: number,
    public readonly maxY: number,

    // EdgedClipped counts
    public readonly minXCount: number,
    public readonly minYCount: number,
    public readonly maxXCount: number,
    public readonly maxYCount: number
  ) {}

  public withEdgeInfo( startIndex: number, endIndex: number ): RasterChunk {
    return new RasterChunk(
      this.rasterProgramIndex,
      this.needsFace,
      this.isConstant,
      startIndex,
      endIndex - startIndex,
      this.minX, this.minY, this.maxX, this.maxY,
      this.minXCount, this.minYCount, this.maxXCount, this.maxYCount
    );
  }

  public toString(): string {
    if ( isNaN( this.rasterProgramIndex ) ) {
      return 'RasterChunk[INDETERMINATE]';
    }
    const counts = `counts:${this.minXCount},${this.minYCount},${this.maxXCount},${this.maxYCount}`;
    const bounds = `bounds:x[${this.minX},${this.maxX}],y[${this.minY},${this.maxY}]`;
    const needs = this.needsFace ? ' needsFace' : '';
    return `RasterChunk[prog:${this.rasterProgramIndex} ${counts} ${bounds} numEdges:${this.numEdges} edgesOffset:${this.edgesOffset}${needs}]`;
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

        assert( isFinite( chunk.rasterProgramIndex ) );
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
