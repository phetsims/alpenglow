// Copyright 2023, University of Colorado Boulder

/**
 * Represents an edge from a RasterChunk
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow } from '../../imports.js';
import Vector2 from '../../../../dot/js/Vector2.js';

export default class RasterEdge {
  public constructor(
    public readonly chunkIndex: number,
    public readonly isFirstEdge: boolean,
    public readonly isLastEdge: boolean,
    public readonly startPoint: Vector2,
    public readonly endPoint: Vector2
  ) {}

  public toString(): string {
    if ( isNaN( this.chunkIndex ) ) {
      return 'RasterEdge[INDETERMINATE]';
    }
    const firstLast = this.isFirstEdge ? ( this.isLastEdge ? ' BOTH' : ' FIRST' ) : ( this.isLastEdge ? ' LAST' : '' );
    return `RasterEdge[chunk:${this.chunkIndex} ${this.startPoint.x},${this.startPoint.y} => ${this.endPoint.x},${this.endPoint.y}${firstLast}]`;
  }

  public static readonly INDETERMINATE = new RasterEdge(
    NaN, false, false, new Vector2( NaN, NaN ), new Vector2( NaN, NaN )
  );
}

alpenglow.register( 'RasterEdge', RasterEdge );
