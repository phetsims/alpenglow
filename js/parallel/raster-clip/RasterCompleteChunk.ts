// Copyright 2023, University of Colorado Boulder

/**
 * Contains path data within a bounds, for a particular RenderProgram
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow } from '../../imports.js';

export default class RasterCompleteChunk {
  public constructor(
    public readonly rasterProgramIndex: number,

    public readonly edgesOffset: number,
    public readonly numEdges: number,
    public readonly isFullArea: boolean,
    public readonly area: number,

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

  public withEdgeInfo( startIndex: number, endIndex: number ): RasterCompleteChunk {
    return new RasterCompleteChunk(
      this.rasterProgramIndex,
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
    if ( isNaN( this.rasterProgramIndex ) ) {
      return 'RasterCompleteChunk[INDETERMINATE]';
    }
    const counts = `counts:${this.minXCount},${this.minYCount},${this.maxXCount},${this.maxYCount}`;
    const bounds = `bounds:x[${this.minX},${this.maxX}],y[${this.minY},${this.maxY}]`;
    const area = `area:${this.area}`;
    const isFullArea = this.isFullArea ? ' fullArea' : '';
    return `RasterCompleteChunk[prog:${this.rasterProgramIndex} ${counts} ${bounds} numEdges:${this.numEdges} edgesOffset:${this.edgesOffset} ${area}${isFullArea}]`;
  }

  public static readonly INDETERMINATE = new RasterCompleteChunk(
    NaN, NaN, NaN, false, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN
  );
}

alpenglow.register( 'RasterCompleteChunk', RasterCompleteChunk );
