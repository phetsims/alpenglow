// Copyright 2023, University of Colorado Boulder

/**
 * TODO doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow } from '../../imports.js';
import Vector2 from '../../../../dot/js/Vector2.js';

export default class RasterEdgeClip {
  public constructor(
    public readonly point0: Vector2,
    public readonly point1: Vector2,
    public readonly point2: Vector2,
    public readonly point3: Vector2,

    // TODO: check when these are actually used
    public readonly isFirstEdge: boolean,
    public readonly isLastEdge: boolean
  ) {}

  public getCount(): number {
    return ( this.point0.equals( this.point1 ) ? 0 : 1 ) +
           ( this.point1.equals( this.point2 ) ? 0 : 1 ) +
           ( this.point2.equals( this.point3 ) ? 0 : 1 );
  }

  public getArea(): number {
    return 0.5 * (
      ( this.point1.x + this.point0.x ) * ( this.point1.y - this.point0.y ) +
      ( this.point2.x + this.point1.x ) * ( this.point2.y - this.point1.y ) +
      ( this.point3.x + this.point2.x ) * ( this.point3.y - this.point2.y )
    );
  }

  public static readonly INDETERMINATE = new RasterEdgeClip(
    new Vector2( NaN, NaN ),
    new Vector2( NaN, NaN ),
    new Vector2( NaN, NaN ),
    new Vector2( NaN, NaN ),
    false,
    false
  );
}

alpenglow.register( 'RasterEdgeClip', RasterEdgeClip );