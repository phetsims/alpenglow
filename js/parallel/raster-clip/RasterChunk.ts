// Copyright 2023, University of Colorado Boulder

/**
 * Contains path data within a bounds, for a particular RenderProgram
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow } from '../../imports.js';

export default class RasterChunk {
  public constructor(
    public readonly rasterProgramIndex: number,
    public readonly needsCentroid: boolean,
    public readonly needsFace: boolean,
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

  public toString(): string {
    if ( isNaN( this.rasterProgramIndex ) ) {
      return 'RasterChunk[INDETERMINATE]';
    }
    const counts = `counts:${this.minXCount},${this.minYCount},${this.maxXCount},${this.maxYCount}`;
    const bounds = `bounds:x[${this.minX},${this.maxX}],y[${this.minY},${this.maxY}]`;
    const needs = ( this.needsCentroid ? ' needsCentroid' : '' ) + ( this.needsFace ? ' needsFace' : '' );
    return `RasterChunk[prog:${this.rasterProgramIndex} ${counts} ${bounds} numEdges:${this.numEdges} edgesOffset:${this.edgesOffset}${needs}]`;
  }

  public static readonly INDETERMINATE = new RasterChunk(
    NaN, false, false, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN
  );
}

alpenglow.register( 'RasterChunk', RasterChunk );
