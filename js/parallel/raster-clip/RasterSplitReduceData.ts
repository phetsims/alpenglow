// Copyright 2023, University of Colorado Boulder

/**
 * A pair of counts (reducible/complete).
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, RasterClippedChunk, RasterEdgeClip } from '../../imports.js';

export default class RasterSplitReduceData {
  public constructor(
    public readonly numReducible: number,
    public readonly numComplete: number
  ) {}

  public toString(): string {
    if ( isNaN( this.numReducible ) ) {
      return 'RasterSplitReduceData[INDETERMINATE]';
    }
    return `RasterSplitReduceData[reduce:${this.numReducible} complete:${this.numComplete}]`;
  }

  public static combine( a: RasterSplitReduceData, b: RasterSplitReduceData ): RasterSplitReduceData {
    return new RasterSplitReduceData(
      a.numReducible + b.numReducible,
      a.numComplete + b.numComplete
    );
  }

  public static from( edgeClip: RasterEdgeClip, clippedChunk: RasterClippedChunk, exists: boolean ): RasterSplitReduceData {
    const isReducible = clippedChunk.isReducible;
    const count = exists ? edgeClip.getCount() : 0;

    return new RasterSplitReduceData(
      isReducible ? count : 0,
      clippedChunk.isExportingCompleteEdges() ? count : 0
    );
  }

  public static readonly INDETERMINATE = new RasterSplitReduceData(
    NaN, NaN
  );

  public static readonly IDENTITY = new RasterSplitReduceData(
    0, 0
  );
}

alpenglow.register( 'RasterSplitReduceData', RasterSplitReduceData );
