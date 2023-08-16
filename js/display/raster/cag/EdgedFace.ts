// Copyright 2023, University of Colorado Boulder

/**
 * A ClippableFace from a set of line segment edges. Should still represent multiple closed loops, but it is not
 * explicit.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { ClippableFace, LinearEdge, PolygonClipping, scenery } from '../../../imports.js';
import Bounds2 from '../../../../../dot/js/Bounds2.js';
import Range from '../../../../../dot/js/Range.js';
import Vector2 from '../../../../../dot/js/Vector2.js';

export default class EdgedFace implements ClippableFace {
  public constructor( public readonly edges: LinearEdge[] ) {}

  public getBounds(): Bounds2 {
    const result = Bounds2.NOTHING.copy();
    for ( let i = 0; i < this.edges.length; i++ ) {
      const edge = this.edges[ i ];

      if ( !edge.containsFakeCorner ) {
        result.addPoint( edge.startPoint );
        result.addPoint( edge.endPoint );
      }
    }
    return result;
  }

  public getDotRange( normal: Vector2 ): Range {
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;

    for ( let i = 0; i < this.edges.length; i++ ) {
      const edge = this.edges[ i ];

      // TODO: containsFakeCorner should... propagate with clipping operations, no?
      if ( !edge.containsFakeCorner ) {
        const dotStart = edge.startPoint.dot( normal );
        const dotEnd = edge.endPoint.dot( normal );
        min = Math.min( min, dotStart, dotEnd );
        max = Math.max( max, dotStart, dotEnd );
      }
    }

    return new Range( min, max );
  }

  public getArea(): number {
    let area = 0;
    for ( let i = 0; i < this.edges.length; i++ ) {
      const edge = this.edges[ i ];

      const p0 = edge.startPoint;
      const p1 = edge.endPoint;
      // PolygonIntegrals.evaluateShoelaceArea( p0.x, p0.y, p1.x, p1.y );
      area += ( p1.x + p0.x ) * ( p1.y - p0.y );
    }

    return 0.5 * area;
  }

  public getCentroid( area: number ): Vector2 {
    let x = 0;
    let y = 0;

    for ( let i = 0; i < this.edges.length; i++ ) {
      const edge = this.edges[ i ];

      const p0 = edge.startPoint;
      const p1 = edge.endPoint;

      // evaluateCentroidPartial
      const base = ( 1 / 6 ) * ( p0.x * p1.y - p1.x * p0.y );
      x += ( p0.x + p1.x ) * base;
      y += ( p0.y + p1.y ) * base;
    }

    return new Vector2(
      x / area,
      y / area
    );
  }

  public getClipped( bounds: Bounds2 ): EdgedFace {
    const edges: LinearEdge[] = [];

    for ( let i = 0; i < this.edges.length; i++ ) {
      const edge = this.edges[ i ];
      PolygonClipping.boundsClipEdge( edge.startPoint, edge.endPoint, bounds, edges );
    }

    return new EdgedFace( edges );
  }

  public getBinaryXClip( x: number, fakeCornerY: number ): { minFace: EdgedFace; maxFace: EdgedFace } {
    const minEdges: LinearEdge[] = [];
    const maxEdges: LinearEdge[] = [];

    for ( let i = 0; i < this.edges.length; i++ ) {
      const edge = this.edges[ i ];

      PolygonClipping.binaryXClipEdge( edge.startPoint, edge.endPoint, x, fakeCornerY, minEdges, maxEdges );
    }

    assert && assert( minEdges.every( e => e.startPoint.x <= x && e.endPoint.x <= x ) );
    assert && assert( maxEdges.every( e => e.startPoint.x >= x && e.endPoint.x >= x ) );

    return {
      minFace: new EdgedFace( minEdges ),
      maxFace: new EdgedFace( maxEdges )
    };
  }

  public getBinaryYClip( y: number, fakeCornerX: number ): { minFace: EdgedFace; maxFace: EdgedFace } {
    const minEdges: LinearEdge[] = [];
    const maxEdges: LinearEdge[] = [];

    for ( let i = 0; i < this.edges.length; i++ ) {
      const edge = this.edges[ i ];

      PolygonClipping.binaryYClipEdge( edge.startPoint, edge.endPoint, y, fakeCornerX, minEdges, maxEdges );
    }

    assert && assert( minEdges.every( e => e.startPoint.y <= y && e.endPoint.y <= y ) );
    assert && assert( maxEdges.every( e => e.startPoint.y >= y && e.endPoint.y >= y ) );

    return {
      minFace: new EdgedFace( minEdges ),
      maxFace: new EdgedFace( maxEdges )
    };
  }

  public getBinaryLineClip( normal: Vector2, value: number, fakeCornerPerpendicular: number ): { minFace: EdgedFace; maxFace: EdgedFace } {
    const minEdges: LinearEdge[] = [];
    const maxEdges: LinearEdge[] = [];

    for ( let i = 0; i < this.edges.length; i++ ) {
      const edge = this.edges[ i ];

      PolygonClipping.binaryLineClipEdge( edge.startPoint, edge.endPoint, normal, value, fakeCornerPerpendicular, minEdges, maxEdges );
    }

    assert && assert( minEdges.every( e => normal.dot( e.startPoint ) <= value && normal.dot( e.endPoint ) <= value ) );
    assert && assert( maxEdges.every( e => normal.dot( e.startPoint ) >= value && normal.dot( e.endPoint ) >= value ) );

    return {
      minFace: new EdgedFace( minEdges ),
      maxFace: new EdgedFace( maxEdges )
    };
  }

  public getStripeLineClip( normal: Vector2, values: number[], fakeCornerPerpendicular: number ): EdgedFace[] {
    const edgesCollection: LinearEdge[][] = _.range( values.length + 1 ).map( () => [] );

    for ( let i = 0; i < this.edges.length; i++ ) {
      const edge = this.edges[ i ];

      PolygonClipping.binaryStripeClipEdge( edge.startPoint, edge.endPoint, normal, values, fakeCornerPerpendicular, edgesCollection );
    }

    if ( assert ) {
      for ( let i = 0; i < edgesCollection.length; i++ ) {
        const edges = edgesCollection[ i ];

        const minValue = i > 0 ? values[ i - 1 ] : Number.NEGATIVE_INFINITY;
        const maxValue = i < values.length ? values[ i ] : Number.POSITIVE_INFINITY;

        assert( edges.every( e => {
          return normal.dot( e.startPoint ) + 1e-8 >= minValue && normal.dot( e.startPoint ) - 1e-8 <= maxValue &&
                 normal.dot( e.endPoint ) + 1e-8 >= minValue && normal.dot( e.endPoint ) - 1e-8 <= maxValue;
        } ) );
      }
    }

    return edgesCollection.map( edges => new EdgedFace( edges ) );
  }
}

scenery.register( 'EdgedFace', EdgedFace );
