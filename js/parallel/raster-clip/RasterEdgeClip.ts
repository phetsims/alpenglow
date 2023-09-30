// Copyright 2023, University of Colorado Boulder

/**
 * TODO doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, LinearEdge } from '../../imports.js';
import Vector2 from '../../../../dot/js/Vector2.js';

export default class RasterEdgeClip {
  public constructor(
    public readonly point0: Vector2,
    public readonly point1: Vector2,
    public readonly point2: Vector2,
    public readonly point3: Vector2,
    public readonly isFirstEdge: boolean
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

  public static fromEdges( edges: LinearEdge[], isFirstEdge: boolean ): RasterEdgeClip {
    if ( edges.length === 0 ) {
      return new RasterEdgeClip(
        Vector2.ZERO,
        Vector2.ZERO,
        Vector2.ZERO,
        Vector2.ZERO,
        isFirstEdge
      );
    }
    else if ( edges.length === 1 ) {
      return new RasterEdgeClip(
        edges[ 0 ].startPoint,
        edges[ 0 ].endPoint,
        edges[ 0 ].endPoint,
        edges[ 0 ].endPoint,
        isFirstEdge
      );
    }
    else if ( edges.length === 2 ) {
      assert && assert( edges[ 0 ].endPoint.equals( edges[ 1 ].startPoint ) );

      return new RasterEdgeClip(
        edges[ 0 ].startPoint,
        edges[ 1 ].startPoint,
        edges[ 1 ].endPoint,
        edges[ 1 ].endPoint,
        isFirstEdge
      );
    }
    else {
      assert && assert( edges[ 0 ].endPoint.equals( edges[ 1 ].startPoint ) );
      assert && assert( edges[ 1 ].endPoint.equals( edges[ 2 ].startPoint ) );

      return new RasterEdgeClip(
        edges[ 0 ].startPoint,
        edges[ 1 ].startPoint,
        edges[ 2 ].startPoint,
        edges[ 2 ].endPoint,
        isFirstEdge
      );
    }
  }

  public static readonly INDETERMINATE = new RasterEdgeClip(
    new Vector2( NaN, NaN ),
    new Vector2( NaN, NaN ),
    new Vector2( NaN, NaN ),
    new Vector2( NaN, NaN ),
    false
  );
}

alpenglow.register( 'RasterEdgeClip', RasterEdgeClip );
