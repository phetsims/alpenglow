// Copyright 2023, University of Colorado Boulder

/**
 * TODO doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, RasterChunkReduceData } from '../../imports.js';

export default class RasterChunkReduceQuad {
  public constructor(
    public leftMin: RasterChunkReduceData,
    public leftMax: RasterChunkReduceData,
    public rightMin: RasterChunkReduceData,
    public rightMax: RasterChunkReduceData
  ) {}

  public static readonly INDETERMINATE = new RasterChunkReduceQuad(
    RasterChunkReduceData.INDETERMINATE,
    RasterChunkReduceData.INDETERMINATE,
    RasterChunkReduceData.INDETERMINATE,
    RasterChunkReduceData.INDETERMINATE
  );

  public static readonly OUT_OF_RANGE = new RasterChunkReduceQuad(
    RasterChunkReduceData.OUT_OF_RANGE,
    RasterChunkReduceData.OUT_OF_RANGE,
    RasterChunkReduceData.OUT_OF_RANGE,
    RasterChunkReduceData.OUT_OF_RANGE
  );
}

alpenglow.register( 'RasterChunkReduceQuad', RasterChunkReduceQuad );
