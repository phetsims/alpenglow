// Copyright 2023, University of Colorado Boulder

/**
 * TODO doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, RasterChunkReduceData } from '../../imports.js';

export default class RasterChunkReducePair {
  public constructor(
    public min: RasterChunkReduceData,
    public max: RasterChunkReduceData
  ) {}

  public static readonly INDETERMINATE = new RasterChunkReducePair(
    RasterChunkReduceData.INDETERMINATE,
    RasterChunkReduceData.INDETERMINATE
  );

  public static readonly OUT_OF_RANGE = new RasterChunkReducePair(
    RasterChunkReduceData.OUT_OF_RANGE,
    RasterChunkReduceData.OUT_OF_RANGE
  );
}

alpenglow.register( 'RasterChunkReducePair', RasterChunkReducePair );
