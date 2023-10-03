// Copyright 2023, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow } from '../../imports.js';

export default class RasterClippedChunk {
  public constructor(
    public readonly rasterProgramIndex: number,
    public readonly needsFace: boolean,

    // Filled in by early steps
    public readonly isReducible: boolean,
    public readonly isComplete: boolean,
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

  public isExportingCompleteEdges(): boolean {
    return this.isComplete && !this.isFullArea && this.needsFace;
  }

  public toString(): string {
    if ( isNaN( this.rasterProgramIndex ) ) {
      return 'RasterClippedChunk[INDETERMINATE]';
    }
    const counts = `counts:${this.minXCount},${this.minYCount},${this.maxXCount},${this.maxYCount}`;
    const bounds = `bounds:x[${this.minX},${this.maxX}],y[${this.minY},${this.maxY}]`;
    const needs = this.needsFace ? ' needsFace' : '';
    const area = `area:${this.area}`;
    const reducible = this.isReducible ? ' reducible' : '';
    const contributing = this.isComplete ? ' complete' : '';
    const fullArea = this.isFullArea ? ' fullArea' : '';
    return `RasterClippedChunk[prog:${this.rasterProgramIndex} ${counts} ${bounds} ${area}${reducible}${contributing}${fullArea}${needs}]`;
  }

  public static readonly INDETERMINATE = new RasterClippedChunk(
    NaN, false, false, false, false, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN
  );

  public static readonly DISCARDABLE = new RasterClippedChunk(
    -1, false, false, false, false, 0, 0, 0, 0, 0, 0, 0, 0, 0
  );
}

alpenglow.register( 'RasterClippedChunk', RasterClippedChunk );
