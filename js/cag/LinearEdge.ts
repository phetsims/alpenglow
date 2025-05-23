// Copyright 2023-2025, University of Colorado Boulder

/**
 * A line segment (between two points).
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import Range from '../../../dot/js/Range.js';
import Vector2 from '../../../dot/js/Vector2.js';
import { Line } from '../../../kite/js/segments/Segment.js';
import Shape from '../../../kite/js/Shape.js';
import { alpenglow } from '../alpenglow.js';
import { ClipSimplifier } from '../clip/ClipSimplifier.js';
import { arePointsCollinear } from '../../../dot/js/util/arePointsCollinear.js';

export class LinearEdge {

  // NOTE: We'll flag these, so that we can accurately compute bounds later when desired (and can skip edges with
  // corner vertices).
  // TODO: how to handle this for performance?

  public constructor(
    public readonly startPoint: Vector2,
    public readonly endPoint: Vector2,
    public readonly containsFakeCorner = false // TODO: propagate fake corners
  ) {
    assert && assert( startPoint.isFinite() );
    assert && assert( endPoint.isFinite() );
    assert && assert( !startPoint.equals( endPoint ) );
  }

  public static fromPolygon( polygon: Vector2[] ): LinearEdge[] {
    const edges: LinearEdge[] = [];

    for ( let i = 0; i < polygon.length; i++ ) {
      edges.push( new LinearEdge(
        polygon[ i ],
        polygon[ ( i + 1 ) % polygon.length ]
      ) );
    }

    return edges;
  }

  public static fromPolygons( polygons: Vector2[][] ): LinearEdge[] {
    return polygons.flatMap( LinearEdge.fromPolygon );
  }

  /**
   * Returns a simplified version of the edges as a list of polygons.
   *
   * NOTE: This is a low-performance method, mainly intended for debugging display.
   */
  public static toPolygons( edges: LinearEdge[], epsilon = 1e-8 ): Vector2[][] {
    const filteredEdges = LinearEdge.withOverlappingRemoved( edges );

    const polygons: Vector2[][] = [];

    const remainingEdges = new Set<LinearEdge>( filteredEdges );

    while ( remainingEdges.size > 0 ) {
      const edge: LinearEdge = remainingEdges.values().next().value!;

      const simplifier = new ClipSimplifier( true );

      let currentEdge = edge;
      do {
        simplifier.add( currentEdge.startPoint.x, currentEdge.startPoint.y );
        remainingEdges.delete( currentEdge );
        if ( edge.startPoint.equalsEpsilon( currentEdge.endPoint, epsilon ) ) {
          break;
        }
        else {
          currentEdge = [ ...remainingEdges ].find( candidateEdge => { // eslint-disable-line @typescript-eslint/no-loop-func
            return candidateEdge.startPoint.equalsEpsilon( currentEdge.endPoint, epsilon );
          } )!;
        }
      } while ( currentEdge !== edge );

      const polygon = simplifier.finalize();

      if ( polygon.length >= 3 ) {
        polygons.push( polygon );
      }
    }

    return polygons;
  }

  /**
   * Detects edges that are exact opposites of other edges, and returns a new list of edges with those removed.
   */
  public static withOppositesRemoved( edges: LinearEdge[], epsilon = 1e-8 ): LinearEdge[] {
    const outputEdges = [];
    const remainingEdges = new Set<LinearEdge>( edges );

    while ( remainingEdges.size > 0 ) {
      const edge: LinearEdge = remainingEdges.values().next().value!;
      remainingEdges.delete( edge );

      const opposite = [ ...remainingEdges ].find( candidateEdge => {
        return candidateEdge.startPoint.equalsEpsilon( edge.endPoint, epsilon ) &&
               candidateEdge.endPoint.equalsEpsilon( edge.startPoint, epsilon );
      } );
      if ( opposite ) {
        remainingEdges.delete( opposite );
      }
      else {
        outputEdges.push( edge );
      }
    }

    return outputEdges;
  }

  /**
   * Detects ANY "opposite-direction" overlap between edges, and returns a new list of edges with those removed.
   *
   * NOTE: This is a low-performance method, mainly intended for debugging display.
   */
  public static withOverlappingRemoved( edges: LinearEdge[], epsilon = 1e-8 ): LinearEdge[] {
    const outputEdges = new Set<LinearEdge>();
    const remainingEdges = new Set<LinearEdge>( edges );

    // Append any edges that are not overlapping. If we detect an overlap, eject the overlapping edges and add their
    // non-overlapped portions.
    while ( remainingEdges.size > 0 ) {
      const edge: LinearEdge = remainingEdges.values().next().value!;
      remainingEdges.delete( edge );

      let overlapped = false;
      for ( const outputEdge of outputEdges ) {
        // See if the edges are collinear
        if ( arePointsCollinear( edge.startPoint, edge.endPoint, outputEdge.startPoint, epsilon ) &&
             arePointsCollinear( edge.startPoint, edge.endPoint, outputEdge.endPoint, epsilon ) ) {
          const overlaps = Line.getOverlaps( new Line( edge.startPoint, edge.endPoint ), new Line( outputEdge.startPoint, outputEdge.endPoint ), epsilon );

          if ( overlaps.length > 0 ) {
            // Lines will just have one potential overlap
            const overlap = overlaps[ 0 ];

            // Ensure that we're removing "opposites" to maintain winding order and signed area.
            // Additionally, make sure that our overlap is non-trivial (i.e. not just a single point).
            if ( overlap.a >= 0 || overlap.t0 + epsilon >= overlap.t1 || overlap.qt0 + epsilon >= overlap.qt1 ) {
              continue;
            }

            const deltaEdge = edge.endPoint.minus( edge.startPoint );
            const deltaOutputEdge = outputEdge.endPoint.minus( outputEdge.startPoint );

            const newEdgeStart = edge.startPoint.plus( deltaEdge.times( overlap.t0 ) );
            const newEdgeEnd = edge.startPoint.plus( deltaEdge.times( overlap.t1 ) );
            const newOutputEdgeStart = outputEdge.startPoint.plus( deltaOutputEdge.times( overlap.qt0 ) );
            const newOutputEdgeEnd = outputEdge.startPoint.plus( deltaOutputEdge.times( overlap.qt1 ) );

            if ( assertSlow ) {
              assertSlow( overlap.t0 < overlap.t1 );
              assertSlow( overlap.qt0 < overlap.qt1 );

              // We should be matching one of the orientations!
              assertSlow(
                ( newEdgeStart.equalsEpsilon( newOutputEdgeStart, epsilon ) && newEdgeEnd.equalsEpsilon( newOutputEdgeEnd, epsilon ) ) ||
                ( newEdgeStart.equalsEpsilon( newOutputEdgeEnd, epsilon ) && newEdgeEnd.equalsEpsilon( newOutputEdgeStart, epsilon ) )
              );
            }

            outputEdges.delete( outputEdge );

            if ( !edge.startPoint.equalsEpsilon( newEdgeStart, epsilon ) ) {
              remainingEdges.add( new LinearEdge( edge.startPoint, newEdgeStart ) );
            }
            if ( !edge.endPoint.equalsEpsilon( newEdgeEnd, epsilon ) ) {
              remainingEdges.add( new LinearEdge( newEdgeEnd, edge.endPoint ) );
            }
            if ( !outputEdge.startPoint.equalsEpsilon( newOutputEdgeStart, epsilon ) ) {
              remainingEdges.add( new LinearEdge( outputEdge.startPoint, newOutputEdgeStart ) );
            }
            if ( !outputEdge.endPoint.equalsEpsilon( newOutputEdgeEnd, epsilon ) ) {
              remainingEdges.add( new LinearEdge( newOutputEdgeEnd, outputEdge.endPoint ) );
            }

            overlapped = true;
            break;
          }
        }
      }

      if ( !overlapped ) {
        outputEdges.add( edge );
      }
    }

    const result = [ ...outputEdges ];

    if ( assertSlow ) {
      const beforeArea = LinearEdge.getEdgesArea( edges );
      const afterArea = LinearEdge.getEdgesArea( result );

      assertSlow( Math.abs( beforeArea - afterArea ) < 1e-6 );
    }

    return result;
  }

  /**
   * Returns a simplified version of the polygons as a kite Shape.
   *
   * TODO: perhaps... move something like this to kite?
   *
   * NOTE: This is a low-performance method, mainly intended for debugging display.
   */
  public static polygonsToShape( polygons: Vector2[][] ): Shape {
    const shape = new Shape();

    // Apply our cleanup methods, that will remove overlap
    polygons = LinearEdge.toPolygons( LinearEdge.fromPolygons( polygons ) );

    polygons.forEach( polygon => {
      if ( polygon.length >= 3 ) {
        shape.moveToPoint( polygon[ 0 ] );
        for ( let i = 1; i < polygon.length; i++ ) {
          shape.lineToPoint( polygon[ i ] );
        }
        shape.close();
      }
    } );

    return shape;
  }

  // Cancelled subexpressions for fewer multiplications
  public static evaluateLineIntegralShoelaceArea( p0x: number, p0y: number, p1x: number, p1y: number ): number {
    return 0.5 * ( p1x + p0x ) * ( p1y - p0y );
  }

  // Without the subexpression cancelling
  public static evaluateLineIntegralArea( p0x: number, p0y: number, p1x: number, p1y: number ): number {
    return 0.5 * ( p0x * p1y - p0y * p1x );
  }

  /**
   * If you take the sum of these for a closed polygon and DIVIDE IT by the area, it should be the centroid of the
   * polygon.
   */
  public static evaluateLineIntegralPartialCentroid( p0x: number, p0y: number, p1x: number, p1y: number ): Vector2 {
    const base = ( p0x * ( 2 * p0y + p1y ) + p1x * ( p0y + 2 * p1y ) ) / 6;

    return new Vector2(
      ( p0x - p1x ) * base,
      ( p1y - p0y ) * base
    );
  }

  public static evaluateLineIntegralZero( p0x: number, p0y: number, p1x: number, p1y: number ): number {
    return ( p0x - 0.1396 ) * ( p0y + 1.422 ) - ( p1x - 0.1396 ) * ( p1y + 1.422 );
  }

  public static evaluateLineIntegralDistance( p0x: number, p0y: number, p1x: number, p1y: number ): number {
    const dx = p1x - p0x;
    const dy = p1y - p0y;
    const qd = Math.sqrt( dx * dx + dy * dy );

    if ( Math.abs( qd ) < 1e-8 ) {
      return 0;
    }

    const q0 = Math.sqrt( p0x * p0x + p0y * p0y );
    const denom = ( p0x * dx + q0 * qd + p0y * dy );

    if ( Math.abs( denom ) < 1e-8 ) {
      return 0;
    }

    const q1 = Math.sqrt( p1x * p1x + p1y * p1y );
    const kx = p1x * p1x - p0x * p1x;
    const ky = p1y * p1y - p0y * p1y;

    const logger = ( kx + ky + qd * q1 ) / denom;

    if ( Math.abs( logger ) < 1e-8 ) {
      return 0;
    }

    const a = p0x * p1y - p0y * p1x;

    // TODO: return zero for when we would return NaN?

    return a / ( 6 * qd * qd * qd ) * (
      qd * ( q0 * ( p0x * p0x - p0x * p1x - p0y * dy ) + q1 * ( kx + p1y * dy ) ) +
      a * a * ( Math.log( logger ) )
    );
  }

  /**
   * If you take the sum of these for a closed polygon, it should be the area of the polygon.
   */
  public getLineIntegralArea(): number {
    return LinearEdge.evaluateLineIntegralShoelaceArea(
      this.startPoint.x, this.startPoint.y, this.endPoint.x, this.endPoint.y
    );
  }

  // TODO: use this to check all of our LinearEdge computations
  /**
   * If you take the sum of these for a closed polygon, it should be zero (used to check computations).
   */
  public getLineIntegralZero(): number {
    return LinearEdge.evaluateLineIntegralZero(
      this.startPoint.x, this.startPoint.y, this.endPoint.x, this.endPoint.y
    );
  }

  public serialize(): SerializedLinearEdge {
    return {
      startPoint: { x: this.startPoint.x, y: this.startPoint.y },
      endPoint: { x: this.endPoint.x, y: this.endPoint.y },
      containsFakeCorner: this.containsFakeCorner
    };
  }

  public static deserialize( obj: SerializedLinearEdge ): LinearEdge {
    return new LinearEdge(
      new Vector2( obj.startPoint.x, obj.startPoint.y ),
      new Vector2( obj.endPoint.x, obj.endPoint.y ),
      obj.containsFakeCorner
    );
  }

  public static getPolygonArea( polygon: Vector2[] ): number {
    let sum = 0;

    // TODO: micro-optimize if used?
    for ( let i = 0; i < polygon.length; i++ ) {
      const p0 = polygon[ i % polygon.length ];
      const p1 = polygon[ ( i + 1 ) % polygon.length ];

      // PolygonIntegrals.evaluateShoelaceArea( p0.x, p0.y, p1.x, p1.y );
      sum += 0.5 * ( p1.x + p0.x ) * ( p1.y - p0.y );
    }

    return sum;
  }

  public static getPolygonCentroid( polygon: Vector2[] ): Vector2 {
    let x = 0;
    let y = 0;

    // TODO: micro-optimize if used a lot
    for ( let i = 0; i < polygon.length; i++ ) {
      const p0 = polygon[ i % polygon.length ];
      const p1 = polygon[ ( i + 1 ) % polygon.length ];

      // Partial centroid evaluation. NOTE: using the compound version here, for performance/stability tradeoffs
      const base = ( p0.x * ( 2 * p0.y + p1.y ) + p1.x * ( p0.y + 2 * p1.y ) );
      x += ( p0.x - p1.x ) * base;
      y += ( p1.y - p0.y ) * base;
    }

    const sixArea = 6 * LinearEdge.getPolygonArea( polygon );

    return new Vector2(
      x / sixArea,
      y / sixArea
    );
  }

  public static getEdgesArea( clippedEdges: LinearEdge[] ): number {
    let sum = 0;

    for ( let i = 0; i < clippedEdges.length; i++ ) {
      sum += clippedEdges[ i ].getLineIntegralArea();
    }

    return sum;
  }

  /**
   * Given a line segment, returns the distance from the origin to the closest point on the line segment.
   */
  public static evaluateClosestDistanceToOrigin( p0x: number, p0y: number, p1x: number, p1y: number ): number {
    const dx = p1x - p0x;
    const dy = p1y - p0y;
    const dMagnitude = Math.sqrt( dx * dx + dy * dy );

    // Normalized delta (start => end)
    const normalizedDX = dx / dMagnitude;
    const normalizedDY = dy / dMagnitude;

    // dot-products of our normalized delta with the start points. This is essentially projecting our start/end points
    // onto a line that is parallel to start-end, but GOES THROUGH THE ORIGIN.
    const startU = p0x * normalizedDX + p0y * normalizedDY;
    const endU = p1x * normalizedDX + p1y * normalizedDY;

    // If the signs are different, then the projection of our segment goes THROUGH the origin, which means that the
    // closest point is in the middle of the line segment
    if ( startU * endU < 0 ) {
      // Normalized perpendicular to start => end
      const perpendicularX = -normalizedDY;
      const perpendicularY = normalizedDX;

      // We can essentially look now at things from the perpendicular orientation. If we take a perpendicular vector
      // that is normalized, its dot-product with both the start and ending point will be the distance to the line
      // (it should be the same).
      return Math.abs( p0x * perpendicularX + p0y * perpendicularY );
    }
    else {
      // Endpoint is the closest, just compute the distance to the closer point (which we can identify by its projection
      // being closer to the origin).
      return Math.abs( startU ) < Math.abs( endU )
             ? Math.sqrt( p0x * p0x + p0y * p0y )
             : Math.sqrt( p1x * p1x + p1y * p1y );
    }
  }

  /**
   * Tests if the point (x,y) is left/on/right of the infinite line determined by (p0x,p0y) and (p1x,p1y).
   * Return: >0 for P2 left of the line through P0 and P1
   *         =0 for P2  on the line
   *         <0 for P2  right of the line
   */
  public static leftComparison( p0x: number, p0y: number, p1x: number, p1y: number, x: number, y: number ): number {
    return ( p1x - p0x ) * ( y - p0y ) - ( x - p0x ) * ( p1y - p0y );
  }

  /**
   * Gets the winding contribution of an edge segment to a point with the Dan Sunday winding number algorithm.
   *
   * See https://web.archive.org/web/20130126163405/http://geomalgorithms.com/a03-_inclusion.html
   */
  public static windingContribution( p0x: number, p0y: number, p1x: number, p1y: number, x: number, y: number ): number {
    if ( p0y <= y ) {
      // If it's an upward crossing and P is to the left of the edge
      if ( p1y > y && LinearEdge.leftComparison( p0x, p0y, p1x, p1y, x, y ) > 0 ) {
        return 1; // have a valid "up" intersection
      }
    }
    else { // p0y > y (no test needed)
      // If it's a downward crossing and P is to the right of the edge
      if ( p1y <= y && LinearEdge.leftComparison( p0x, p0y, p1x, p1y, x, y ) < 0 ) {
        return -1; // have a valid "down" intersection
      }
    }

    return 0;
  }

  public static getWindingNumberEdges( edges: LinearEdge[], point: Vector2 ): number {
    let windingNumber = 0;

    for ( let i = 0; i < edges.length; i++ ) {
      const edge = edges[ i ];
      windingNumber += LinearEdge.windingContribution(
        edge.startPoint.x, edge.startPoint.y, edge.endPoint.x, edge.endPoint.y, point.x, point.y
      );
    }

    return windingNumber;
  }

  public static getWindingNumberPolygon( polygon: Vector2[], point: Vector2 ): number {
    let windingNumber = 0;

    for ( let i = 0; i < polygon.length; i++ ) {
      const p0 = polygon[ i ];
      const p1 = polygon[ ( i + 1 ) % polygon.length ];
      windingNumber += LinearEdge.windingContribution(
        p0.x, p0.y, p1.x, p1.y, point.x, point.y
      );
    }

    return windingNumber;
  }

  public static getWindingNumberPolygons( polygons: Vector2[][], point: Vector2 ): number {
    let windingNumber = 0;

    for ( let i = 0; i < polygons.length; i++ ) {
      windingNumber += LinearEdge.getWindingNumberPolygon( polygons[ i ], point );
    }

    return windingNumber;
  }

  /**
   * Given an edge defined by startPoint/endPoint, compute the range of distances from the given point to the edge, and
   * add it to the range.
   */
  public static addDistanceRange( startPoint: Vector2, endPoint: Vector2, point: Vector2, range: Range ): void {
    const p0x = startPoint.x - point.x;
    const p0y = startPoint.y - point.y;
    const p1x = endPoint.x - point.x;
    const p1y = endPoint.y - point.y;

    range.min = Math.min( range.min, LinearEdge.evaluateClosestDistanceToOrigin( p0x, p0y, p1x, p1y ) );
    range.max = Math.max( range.max, Math.sqrt( p0x * p0x + p0y * p0y ), Math.sqrt( p1x * p1x + p1y * p1y ) );
  }

  public static validateStartEndMatches( edges: LinearEdge[] ): void {
    if ( assertSlow ) {
      const zero = _.sum( edges.map( e => e.getLineIntegralZero() ) );
      assertSlow( Math.abs( zero ) < 1e-5, `Ensure we are effectively closed: ${zero}` );

      // Ensure that each point's 'starts' and 'ends' matches precisely
      type Entry = { point: Vector2; startCount: number; endCount: number };
      const entries: Entry[] = [];
      const getEntry = ( point: Vector2 ): Entry => {
        for ( let i = 0; i < entries.length; i++ ) {
          if ( entries[ i ].point.equals( point ) ) {
            return entries[ i ];
          }
        }
        const entry = { point: point, startCount: 0, endCount: 0 };
        entries.push( entry );
        return entry;
      };
      for ( let i = 0; i < edges.length; i++ ) {
        const edge = edges[ i ];
        getEntry( edge.startPoint ).startCount++;
        getEntry( edge.endPoint ).endCount++;
      }
      for ( let i = 0; i < entries.length; i++ ) {
        const entry = entries[ i ];
        assertSlow( entry.startCount === entry.endCount, 'Ensure each point has matching start/end counts' );
      }
    }
  }

  public toString(): string {
    return `${this.startPoint.x},${this.startPoint.y} => ${this.endPoint.x},${this.endPoint.y}`;
  }
}

alpenglow.register( 'LinearEdge', LinearEdge );

export type SerializedLinearEdge = {
  startPoint: { x: number; y: number };
  endPoint: { x: number; y: number };
  containsFakeCorner: boolean;
};