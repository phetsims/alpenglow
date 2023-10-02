// Copyright 2023, University of Colorado Boulder

/**
 * TODO doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, RasterClippedChunk } from '../../imports.js';

export default class RasterChunkReduceData {
  public constructor(
    public readonly chunkIndex: number,
    public readonly area: number,

    // TODO: check which ones of these aren't used
    public readonly isFirstEdge: boolean,
    public readonly isLastEdge: boolean,

    // TODO: centroid?

    // FLOAT(?) bounds
    // TODO: test without this, see how differently we branch?
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

  public isValid(): boolean {
    return !isNaN( this.chunkIndex ) && this.chunkIndex !== -1;
  }

  public toString(): string {
    if ( isNaN( this.chunkIndex ) ) {
      return 'RasterChunkReduceData[INDETERMINATE]';
    }
    if ( this.chunkIndex === -1 ) {
      return 'RasterChunkReduceData[OUT_OF_RANGE]';
    }
    const firstLast = this.isFirstEdge ? ( this.isLastEdge ? ' BOTH' : ' FIRST' ) : ( this.isLastEdge ? ' LAST' : '' );
    const counts = `counts:${this.minXCount},${this.minYCount},${this.maxXCount},${this.maxYCount}`;
    const area = `area:${this.area}`;
    const bounds = `bounds:x[${this.minX},${this.maxX}],y[${this.minY},${this.maxY}]`;
    return `RasterChunkReduceData[chunk:${this.chunkIndex} ${counts} ${bounds} ${area}${firstLast}]`;
  }

  public equals( other: RasterChunkReduceData ): boolean {
    return this.chunkIndex === other.chunkIndex &&
           Math.abs( this.area - other.area ) < 1e-6 &&
           this.isFirstEdge === other.isFirstEdge &&
           this.isLastEdge === other.isLastEdge &&
           this.minX === other.minX &&
           this.minY === other.minY &&
           this.maxX === other.maxX &&
           this.maxY === other.maxY &&
           this.minXCount === other.minXCount &&
           this.minYCount === other.minYCount &&
           this.maxXCount === other.maxXCount &&
           this.maxYCount === other.maxYCount;
  }

  public apply( clippedChunk: RasterClippedChunk ): RasterClippedChunk {

    const minXCount = clippedChunk.minXCount + this.minXCount;
    const minYCount = clippedChunk.minYCount + this.minYCount;
    const maxXCount = clippedChunk.maxXCount + this.maxXCount;
    const maxYCount = clippedChunk.maxYCount + this.maxYCount;

    // NOTE: This ASSUMES that we're using the specific shoelace formulation of ( p1.x + p0.x ) * ( p1.y - p0.y )
    // for the rest of our computations
    // Our minYCount/maxYCount won't contribute (since they have the same Y values, their shoelace contribution will be
    // zero.
    // ALSO: there is a doubling and non-doubling that cancel out here (1/2 from shoelace, 2* due to x+x).
    const countArea = ( clippedChunk.maxY - clippedChunk.minY ) * ( minXCount * clippedChunk.minX + maxXCount * clippedChunk.maxX );

    // TODO: is this bounds restriction helpful? Correct?
    // NOTE: Our clipped edge counts will affect our bounds, so we have lots of conditionals here.
    // If they are NOT affected by the clipped edge counts, we can see if we can shrink the bounds.
    // We're anticipating potential fractional values here, so we difference with the floors.
    // (fractional can happen with offsets from various filters).
    const minX = minXCount === 0 && minYCount === 0 && maxYCount === 0
                 ? clippedChunk.minX + Math.floor( this.minX - clippedChunk.minX )
                 : clippedChunk.minX;
    const minY = minXCount === 0 && minYCount === 0 && maxXCount === 0
                 ? clippedChunk.minY + Math.floor( this.minY - clippedChunk.minY )
                 : clippedChunk.minY;
    const maxX = maxXCount === 0 && minYCount === 0 && maxYCount === 0
                 ? clippedChunk.maxX - Math.floor( clippedChunk.maxX - this.maxX )
                 : clippedChunk.maxX;
    const maxY = minXCount === 0 && maxXCount === 0 && maxYCount === 0
                 ? clippedChunk.maxY - Math.floor( clippedChunk.maxY - this.maxY )
                 : clippedChunk.maxY;

    // Include both area from the clipped-edge counts AND from the actual edges themselves
    const area = countArea + this.area;

    const width = maxX - minX;
    const height = maxY - minY;

    const isDiscarded = area <= 1e-8;
    const isFullArea = area >= width * height - 1e-8;
    const isComplete = isDiscarded || isFullArea || ( width <= 1 + 1e-8 && height <= 1 + 1e-8 );

    return new RasterClippedChunk(
      clippedChunk.rasterProgramIndex,
      clippedChunk.needsFace,

      !isComplete,
      isComplete && !isDiscarded,
      isFullArea,
      area,

      minX, minY, maxX, maxY,
      minXCount, minYCount, maxXCount, maxYCount
    );
  }

  public static combine( a: RasterChunkReduceData, b: RasterChunkReduceData ): RasterChunkReduceData {
    if ( a.chunkIndex !== b.chunkIndex ) {
      return b;
    }
    else {
      return new RasterChunkReduceData(
        a.chunkIndex,
        a.area + b.area,
        a.isFirstEdge,
        b.isLastEdge,
        Math.min( a.minX, b.minX ),
        Math.min( a.minY, b.minY ),
        Math.max( a.maxX, b.maxX ),
        Math.max( a.maxY, b.maxY ),
        a.minXCount + b.minXCount,
        a.minYCount + b.minYCount,
        a.maxXCount + b.maxXCount,
        a.maxYCount + b.maxYCount
      );
    }
  }

  public static readonly INDETERMINATE = new RasterChunkReduceData(
    NaN, NaN, false, false, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN
  );

  public static readonly OUT_OF_RANGE = new RasterChunkReduceData(
    -1, NaN, false, false, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN
  );
}

alpenglow.register( 'RasterChunkReduceData', RasterChunkReduceData );
