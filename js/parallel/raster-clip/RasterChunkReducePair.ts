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
  ) {
    assert && assert( min.isFirstEdge === max.isFirstEdge );
    assert && assert( min.isLastEdge === max.isLastEdge );
    assert && assert( isFinite( min.chunkIndex ) && min.chunkIndex > 0 ? (
      min.chunkIndex + 1 === max.chunkIndex
    ) : true );
  }

  public isFirstEdge(): boolean {
    return this.min.isFirstEdge;
  }

  public isLastEdge(): boolean {
    return this.min.isLastEdge;
  }

  public static combine( a: RasterChunkReducePair, b: RasterChunkReducePair ): RasterChunkReducePair {
    return new RasterChunkReducePair(
      RasterChunkReduceData.combine( a.min, b.min ),
      RasterChunkReduceData.combine( a.max, b.max )
    );
  }

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
