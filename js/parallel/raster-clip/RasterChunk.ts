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

    // Integer bounds
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

  public static readonly INDETERMINATE = new RasterChunk(
    NaN, false, false, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN
  );
}

alpenglow.register( 'RasterChunk', RasterChunk );
