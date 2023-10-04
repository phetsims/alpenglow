// Copyright 2023, University of Colorado Boulder

/**
 * Represents an "applied interval" of reduce data, for both the min and max binary clips.
 *
 * In our segmented reduction, at each level we need to track intervals with the "fragments" of chunks' edges that
 * have not been completed yet.
 *
 * "left" means "the reduction of all values for the chunk index at the start of this interval"
 * "right" means "the reduction of all values for the chunk index at the end of this interval"
 *
 * Sometimes the left/right are equal (IFF they have the same chunk index).
 *
 * Each reduced data notes whether it contains the first/last edge of the chunk it references. Once we combine reduces
 * so that it contains both the first and last edge, we can "apply" it, moving the reduced data into the chunk.
 *
 * TODO: produce general documentation on this whole process.
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
