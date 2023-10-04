// Copyright 2023, University of Colorado Boulder

/**
 * Represents an edge from a RasterCompleteEdgeChunk
 *
 * Output edge for the raster-clip algorithm
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow } from '../../imports.js';
import Vector2 from '../../../../dot/js/Vector2.js';

export default class RasterCompleteEdge {
  public constructor(
    public readonly startPoint: Vector2,
    public readonly endPoint: Vector2
  ) {}

  public toString(): string {
    if ( isNaN( this.startPoint.x ) ) {
      return 'RasterCompleteEdge[INDETERMINATE]';
    }
    return `RasterCompleteEdge[${this.startPoint.x},${this.startPoint.y} => ${this.endPoint.x},${this.endPoint.y}]`;
  }

  public static readonly INDETERMINATE = new RasterCompleteEdge(
    new Vector2( NaN, NaN ), new Vector2( NaN, NaN )
  );
}

alpenglow.register( 'RasterCompleteEdge', RasterCompleteEdge );
