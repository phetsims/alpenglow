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

  public static combine( a: RasterChunkReduceQuad, b: RasterChunkReduceQuad ): RasterChunkReduceQuad {
    return new RasterChunkReduceQuad(
      // We need separate logic for the "left" combine, due to the combine "taking" the right side
      a.leftMin.clippedChunkIndex === b.leftMin.clippedChunkIndex ? RasterChunkReduceData.combine( a.leftMin, b.leftMin ) : a.leftMin,
      a.leftMax.clippedChunkIndex === b.leftMax.clippedChunkIndex ? RasterChunkReduceData.combine( a.leftMax, b.leftMax ) : a.leftMax,
      RasterChunkReduceData.combine( a.rightMin, b.rightMin ),
      RasterChunkReduceData.combine( a.rightMax, b.rightMax )
    );
  }

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
