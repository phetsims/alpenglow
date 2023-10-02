// Copyright 2023, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow } from '../../imports.js';

export default class RasterEdgeReduceData {
  public constructor(
    public readonly numReducible: number,
    public readonly numComplete: number
  ) {}

  public toString(): string {
    if ( isNaN( this.numReducible ) ) {
      return 'RasterEdgeReduceData[INDETERMINATE]';
    }
    return `RasterEdgeReduceData[reduce:${this.numReducible} complete:${this.numComplete}]`;
  }

  public static combine( a: RasterEdgeReduceData, b: RasterEdgeReduceData ): RasterEdgeReduceData {
    return new RasterEdgeReduceData(
      a.numReducible + b.numReducible,
      a.numComplete + b.numComplete
    );
  }

  public static readonly INDETERMINATE = new RasterEdgeReduceData(
    NaN, NaN
  );
}

alpenglow.register( 'RasterEdgeReduceData', RasterEdgeReduceData );
