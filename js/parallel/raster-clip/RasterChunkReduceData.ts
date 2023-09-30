// Copyright 2023, University of Colorado Boulder

/**
 * TODO doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow } from '../../imports.js';

export default class RasterChunkReduceData {
  public constructor(
    public readonly chunkIndex: number,
    public readonly area: number,

    // TODO: centroid?

    // FLOAT(?) bounds - TODO can we use u16 equivalent perhaps?
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

  public static readonly INDETERMINATE = new RasterChunkReduceData(
    NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN
  );
}

alpenglow.register( 'RasterChunkReduceData', RasterChunkReduceData );
