// Copyright 2023-2024, University of Colorado Boulder

/**
 * A ClippableFace from a set of polygons (each one is a closed loop of Vector2s)
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import Bounds2 from '../../../dot/js/Bounds2.js';
import Matrix3 from '../../../dot/js/Matrix3.js';
import Range from '../../../dot/js/Range.js';
import Utils from '../../../dot/js/Utils.js';
import Vector2 from '../../../dot/js/Vector2.js';
import { Shape } from '../../../kite/js/imports.js';
import { alpenglow, BinaryClipping, BoundsClipping, CircularClipping, ClippableFace, ClippableFaceAccumulator, ClipSimplifier, EdgedClippedFace, EdgedFace, GridClipCallback, GridClipping, LinearEdge, PolygonBilinear, PolygonCompleteCallback, PolygonMitchellNetravali, StripeClipping } from '../imports.js';

const scratchVectorA = new Vector2( 0, 0 );
const scratchVectorB = new Vector2( 0, 0 );

// Relies on the main boundary being positive-oriented, and the holes being negative-oriented and non-overlapping
export default class PolygonalFace implements ClippableFace {
  public constructor( public readonly polygons: Vector2[][] ) {}

  /**
   * Converts the face to an edged face.
   */
  public toEdgedFace(): EdgedFace {
    return new EdgedFace( LinearEdge.fromPolygons( this.polygons ) );
  }

  /**
   * Converts the face to a polygonal face.
   */
  public toPolygonalFace( epsilon?: number ): PolygonalFace {
    return this;
  }

  /**
   * Converts the face to a edged-clipped face (scanning the edges, to convert bounds-side edges to counts)
   */
  public toEdgedClippedFace( minX: number, minY: number, maxX: number, maxY: number ): EdgedClippedFace {
    return EdgedClippedFace.fromEdges( LinearEdge.fromPolygons( this.polygons ), minX, minY, maxX, maxY );
  }

  /**
   * Converts the face to a edged-clipped face (without scanning the edges to see if they are bounds-side)
   */
  public toEdgedClippedFaceWithoutCheck( minX: number, minY: number, maxX: number, maxY: number ): EdgedClippedFace {
    return EdgedClippedFace.fromEdgesWithoutCheck( LinearEdge.fromPolygons( this.polygons ), minX, minY, maxX, maxY );
  }

  /**
   * Returns a Shape for the face.
   *
   * NOTE: This is likely a low-performance method, and should only be used for debugging.
   */
  public getShape( epsilon?: number ): Shape {
    return LinearEdge.polygonsToShape( this.polygons );
  }

  /**
   * Returns the bounds of the face (ignoring any "fake" edges, if the type supports them)
   */
  public getBounds(): Bounds2 {
    const result = Bounds2.NOTHING.copy();
    for ( let i = 0; i < this.polygons.length; i++ ) {
      const polygon = this.polygons[ i ];
      for ( let j = 0; j < polygon.length; j++ ) {
        result.addPoint( polygon[ j ] );
      }
    }
    return result;
  }

  /**
   * Returns the range of values for the dot product of the given normal with any point contained within the face
   * (for polygons, this is the same as the range of values for the dot product of the normal with any vertex).
   */
  public getDotRange( normal: Vector2 ): Range {
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;

    for ( let i = 0; i < this.polygons.length; i++ ) {
      const polygon = this.polygons[ i ];
      for ( let j = 0; j < polygon.length; j++ ) {
        const dot = polygon[ j ].dot( normal );
        min = Math.min( min, dot );
        max = Math.max( max, dot );
      }
    }

    return new Range( min, max );
  }

  /**
   * Returns the range of distances from the given point to every point along the edges of the face.
   * For instance, if the face was the unit cube, the range would be 1/2 to sqrt(2), for distances to the middles of
   * the edges and the corners respectively.
   */
  public getDistanceRangeToEdges( point: Vector2 ): Range {
    let min = Number.POSITIVE_INFINITY;
    let max = 0;

    // TODO: Use LinearEdge.addDistanceRange if the function-call overhead isn't too much
    for ( let i = 0; i < this.polygons.length; i++ ) {
      const polygon = this.polygons[ i ];
      for ( let j = 0; j < polygon.length; j++ ) {
        const p0 = polygon[ j ];
        const p1 = polygon[ ( j + 1 ) % polygon.length ];

        const p0x = p0.x - point.x;
        const p0y = p0.y - point.y;
        const p1x = p1.x - point.x;
        const p1y = p1.y - point.y;

        min = Math.min( min, LinearEdge.evaluateClosestDistanceToOrigin( p0x, p0y, p1x, p1y ) );
        max = Math.max( max, Math.sqrt( p0x * p0x + p0y * p0y ), Math.sqrt( p1x * p1x + p1y * p1y ) );
      }
    }

    return new Range( min, max );
  }

  /**
   * Returns the range of distances from the given point to every point inside the face. The upper bound should be
   * the same as getDistanceRangeToEdges, however the lower bound may be 0 if the point is inside the face.
   */
  public getDistanceRangeToInside( point: Vector2 ): Range {
    const range = this.getDistanceRangeToEdges( point );

    if ( this.containsPoint( point ) ) {
      return new Range( 0, range.max );
    }
    else {
      return range;
    }
  }

  /**
   * Returns the signed area of the face (positive if the vertices are in counter-clockwise order, negative if clockwise)
   */
  public getArea(): number {
    let area = 0;
    for ( let i = 0; i < this.polygons.length; i++ ) {
      const polygon = this.polygons[ i ];

      // TODO: optimize more?
      for ( let j = 0; j < polygon.length; j++ ) {
        const p0 = polygon[ j ];
        const p1 = polygon[ ( j + 1 ) % polygon.length ];

        // Shoelace formula for the area
        area += ( p1.x + p0.x ) * ( p1.y - p0.y );
      }
    }

    return 0.5 * area;
  }

  /**
   * Returns the partial for the centroid computation. These should be summed up, divided by 6, and divided by the area
   * to give the full centroid
   */
  public getCentroidPartial(): Vector2 {
    let x = 0;
    let y = 0;

    for ( let i = 0; i < this.polygons.length; i++ ) {
      const polygon = this.polygons[ i ];

      // TODO: optimize more?
      for ( let j = 0; j < polygon.length; j++ ) {
        const p0 = polygon[ j ];
        const p1 = polygon[ ( j + 1 ) % polygon.length ];

        // Partial centroid evaluation. NOTE: using the compound version here, for performance/stability tradeoffs
        const base = ( p0.x * ( 2 * p0.y + p1.y ) + p1.x * ( p0.y + 2 * p1.y ) );
        x += ( p0.x - p1.x ) * base;
        y += ( p1.y - p0.y ) * base;
      }
    }

    return new Vector2( x, y );
  }

  /**
   * Returns the centroid of the face (area is required for the typical integral required to evaluate)
   */
  public getCentroid( area: number ): Vector2 {
    // TODO: we COULD potentially detect if we are a triangle, and skip the partial computation (AND not require the area)

    return this.getCentroidPartial().timesScalar( 1 / ( 6 * area ) );
  }

  /**
   * Returns the evaluation of an integral that will be zero if the boundaries of the face are correctly closed.
   * It is designed so that if there is a "gap" and we have open boundaries, the result will likely be non-zero.
   *
   * NOTE: This is only used for debugging, so performance is not a concern.
   */
  public getZero(): number {
    // We're polygonal, so by definition we are closed
    return 0;
  }

  /**
   * Returns the average distance from the given point to every point inside the face. The integral evaluation requires
   * the area (similarly to the centroid computation).
   */
  public getAverageDistance( point: Vector2, area: number ): number {
    let sum = 0;

    for ( let i = 0; i < this.polygons.length; i++ ) {
      const polygon = this.polygons[ i ];

      // TODO: optimize more?
      for ( let j = 0; j < polygon.length; j++ ) {
        const p0 = polygon[ j ];
        const p1 = polygon[ ( j + 1 ) % polygon.length ];

      sum += LinearEdge.evaluateLineIntegralDistance(
        p0.x - point.x,
        p0.y - point.y,
        p1.x - point.x,
        p1.y - point.y
      );
      }
    }

    return sum / area;
  }

  /**
   * Returns the average distance from the origin to every point inside the face transformed by the given matrix.
   */
  public getAverageDistanceTransformedToOrigin( transform: Matrix3, area: number ): number {
    let sum = 0;

    for ( let i = 0; i < this.polygons.length; i++ ) {
      const polygon = this.polygons[ i ];

      // TODO: optimize more? THIS WILL BE TRICKY due to not creating garbage. rotate scratch vectors!
      for ( let j = 0; j < polygon.length; j++ ) {
        const p0 = transform.multiplyVector2( scratchVectorA.set( polygon[ j ] ) );
        const p1 = transform.multiplyVector2( scratchVectorB.set( polygon[ ( j + 1 ) % polygon.length ] ) );

        sum += LinearEdge.evaluateLineIntegralDistance( p0.x, p0.y, p1.x, p1.y );
      }
    }

    return sum / ( area * transform.getSignedScale() );
  }

  /**
   * Returns a copy of the face that is clipped to be within the given axis-aligned bounding box.
   */
  public getClipped( minX: number, minY: number, maxX: number, maxY: number ): PolygonalFace {
    const centerX = ( minX + maxX ) / 2;
    const centerY = ( minY + maxY ) / 2;

    const polygons: Vector2[][] = [];

    for ( let i = 0; i < this.polygons.length; i++ ) {
      const polygon = this.polygons[ i ];
      const clippedPolygon = BoundsClipping.boundsClipPolygon( polygon, minX, minY, maxX, maxY, centerX, centerY );
      if ( clippedPolygon.length ) {
        polygons.push( clippedPolygon );
      }
    }

    return new PolygonalFace( polygons );
  }

  /**
   * Returns two copies of the face, one that is clipped to be to the left of the given x value, and one that is
   * clipped to be to the right of the given x value.
   *
   * The fakeCornerY is used to determine the "fake" corner that is used for unsorted-edge clipping.
   */
  public getBinaryXClip( x: number, fakeCornerY: number ): { minFace: PolygonalFace; maxFace: PolygonalFace } {
    const minPolygons: Vector2[][] = [];
    const maxPolygons: Vector2[][] = [];

    for ( let i = 0; i < this.polygons.length; i++ ) {
      const polygon = this.polygons[ i ];

      const minPolygon: Vector2[] = [];
      const maxPolygon: Vector2[] = [];

      BinaryClipping.binaryXClipPolygon( polygon, x, minPolygon, maxPolygon );

      minPolygon.length && minPolygons.push( minPolygon );
      maxPolygon.length && maxPolygons.push( maxPolygon );

      assert && assert( minPolygon.every( p => p.x <= x ) );
      assert && assert( maxPolygon.every( p => p.x >= x ) );
    }

    return {
      minFace: new PolygonalFace( minPolygons ),
      maxFace: new PolygonalFace( maxPolygons )
    };
  }

  /**
   * Returns two copies of the face, one that is clipped to y values less than the given y value, and one that is
   * clipped to values greater than the given y value.
   *
   * The fakeCornerX is used to determine the "fake" corner that is used for unsorted-edge clipping.
   */
  public getBinaryYClip( y: number, fakeCornerX: number ): { minFace: PolygonalFace; maxFace: PolygonalFace } {
    const minPolygons: Vector2[][] = [];
    const maxPolygons: Vector2[][] = [];

    for ( let i = 0; i < this.polygons.length; i++ ) {
      const polygon = this.polygons[ i ];

      const minPolygon: Vector2[] = [];
      const maxPolygon: Vector2[] = [];

      BinaryClipping.binaryYClipPolygon( polygon, y, minPolygon, maxPolygon );

      minPolygon.length && minPolygons.push( minPolygon );
      maxPolygon.length && maxPolygons.push( maxPolygon );

      assert && assert( minPolygon.every( p => p.y <= y ) );
      assert && assert( maxPolygon.every( p => p.y >= y ) );
    }

    return {
      minFace: new PolygonalFace( minPolygons ),
      maxFace: new PolygonalFace( maxPolygons )
    };
  }

  /**
   * Returns two copies of the face, one that is clipped to contain points where dot( normal, point ) < value,
   * and one that is clipped to contain points where dot( normal, point ) > value.
   *
   * The fake corner perpendicular is used to determine the "fake" corner that is used for unsorted-edge clipping
   */
  public getBinaryLineClip( normal: Vector2, value: number, fakeCornerPerpendicular: number ): { minFace: PolygonalFace; maxFace: PolygonalFace } {
    const minPolygons: Vector2[][] = [];
    const maxPolygons: Vector2[][] = [];

    for ( let i = 0; i < this.polygons.length; i++ ) {
      const polygon = this.polygons[ i ];

      const minPolygon: Vector2[] = [];
      const maxPolygon: Vector2[] = [];

      BinaryClipping.binaryLineClipPolygon( polygon, normal, value, minPolygon, maxPolygon );

      minPolygon.length && minPolygons.push( minPolygon );
      maxPolygon.length && maxPolygons.push( maxPolygon );

      assert && assert( minPolygon.every( p => normal.dot( p ) - 1e-8 <= value ) );
      assert && assert( maxPolygon.every( p => normal.dot( p ) + 1e-8 >= value ) );
    }

    return {
      minFace: new PolygonalFace( minPolygons ),
      maxFace: new PolygonalFace( maxPolygons )
    };
  }

  /**
   * Returns an array of faces, clipped similarly to getBinaryLineClip, but with more than one (parallel) split line at
   * a time. The first face will be the one with dot( normal, point ) < values[0], the second one with
   * values[ 0 ] < dot( normal, point ) < values[1], etc.
   */
  public getStripeLineClip( normal: Vector2, values: number[], fakeCornerPerpendicular: number ): PolygonalFace[] {
    const polygonsCollection: Vector2[][][] = _.range( values.length + 1 ).map( () => [] );

    for ( let i = 0; i < this.polygons.length; i++ ) {
      const polygon = this.polygons[ i ];

      const polygons = StripeClipping.binaryStripeClipPolygon( polygon, normal, values );

      assert && assert( polygonsCollection.length === polygons.length );

      for ( let j = 0; j < polygons.length; j++ ) {
        const slicePolygon = polygons[ j ];

        polygonsCollection[ j ].push( slicePolygon );

        if ( assert ) {
          const minValue = j > 0 ? values[ j - 1 ] : Number.NEGATIVE_INFINITY;
          const maxValue = j < values.length ? values[ j ] : Number.POSITIVE_INFINITY;

          assert( slicePolygon.every( p => normal.dot( p ) + 1e-8 >= minValue && normal.dot( p ) - 1e-8 <= maxValue ) );
        }
      }
    }

    return polygonsCollection.map( polygons => new PolygonalFace( polygons ) );
  }

  /**
   * Returns two copies of the face, one that is clipped to contain points inside the circle defined by the given
   * center and radius, and one that is clipped to contain points outside the circle.
   *
   * NOTE: maxAngleSplit is used to determine the polygonal approximation of the circle. The returned result will not
   * have a chord with an angle greater than maxAngleSplit.
   */
  public getBinaryCircularClip( center: Vector2, radius: number, maxAngleSplit: number ): { insideFace: PolygonalFace; outsideFace: PolygonalFace } {
    const insidePolygons: Vector2[][] = [];
    const outsidePolygons: Vector2[][] = [];

    CircularClipping.binaryCircularClipPolygon( this.polygons, center, radius, maxAngleSplit, insidePolygons, outsidePolygons );

    return {
      insideFace: new PolygonalFace( insidePolygons ),
      outsideFace: new PolygonalFace( outsidePolygons )
    };
  }

  /**
   * Given an integral bounding box and step sizes (which define the grid), this will clip the face to each cell in the
   * grid, calling the callback for each cell's contributing edges (in order, if we are a PolygonalFace).
   * polygonCompleteCallback will be called whenever a polygon is completed (if we are a polygonal type of face).
   */
  public gridClipIterate(
    minX: number, minY: number, maxX: number, maxY: number,
    stepX: number, stepY: number, stepWidth: number, stepHeight: number,
    callback: GridClipCallback,
    polygonCompleteCallback: PolygonCompleteCallback
  ): void {
    for ( let i = 0; i < this.polygons.length; i++ ) {
      const polygon = this.polygons[ i ];

      for ( let j = 0; j < polygon.length; j++ ) {
        const startPoint = polygon[ j ];
        const endPoint = polygon[ ( j + 1 ) % polygon.length ];

        GridClipping.gridClipIterate(
          startPoint, endPoint,
          minX, minY, maxX, maxY,
          stepX, stepY, stepWidth, stepHeight,
          callback
        );
      }

      if ( polygon.length ) {
        polygonCompleteCallback();
      }
    }
  }

  /**
   * Returns the evaluation of the bilinear (tent) filter integrals for the given point, ASSUMING that the face
   * is clipped to the transformed unit square of x: [minX,minX+1], y: [minY,minY+1].
   */
  public getBilinearFiltered( pointX: number, pointY: number, minX: number, minY: number ): number {
    return PolygonBilinear.evaluatePolygons( this.polygons, pointX, pointY, minX, minY );
  }

  /**
   * Returns the evaluation of the Mitchell-Netravali (1/3,1/3) filter integrals for the given point, ASSUMING that the
   * face is clipped to the transformed unit square of x: [minX,minX+1], y: [minY,minY+1].
   */
  public getMitchellNetravaliFiltered( pointX: number, pointY: number, minX: number, minY: number ): number {
    return PolygonMitchellNetravali.evaluatePolygons( this.polygons, pointX, pointY, minX, minY );
  }

  /**
   * Returns whether the face contains the given point.
   */
  public containsPoint( point: Vector2 ): boolean {
    return LinearEdge.getWindingNumberPolygons( this.polygons, point ) !== 0;
  }

  /**
   * Returns an affine-transformed version of the face.
   */
  public getTransformed( transform: Matrix3 ): PolygonalFace {
    if ( transform.isIdentity() ) {
      return this;
    }
    else {
      return new PolygonalFace( this.polygons.map( polygon => polygon.map( vertex => {
        return transform.timesVector2( vertex );
      } ) ) );
    }
  }

  /**
   * Returns a rounded version of the face, where [-epsilon/2, epsilon/2] rounds to 0, etc.
   */
  public getRounded( epsilon: number ): PolygonalFace {
    return new PolygonalFace( this.polygons.map( polygon => polygon.map( vertex => {
      return new Vector2(
        Utils.roundSymmetric( vertex.x / epsilon ) * epsilon,
        Utils.roundSymmetric( vertex.y / epsilon ) * epsilon
      );
    } ) ) );
  }

  /**
   * Returns a version of the face with the orientation of all of the edges swapped.
   */
  public withReversedEdges(): PolygonalFace {
    return new PolygonalFace(
      this.polygons.map( polygon => polygon.slice().reverse() )
    );
  }

  /**
   * Calls the callback with points for each edge in the face.
   */
  public forEachEdge( callback: ( startPoint: Vector2, endPoint: Vector2 ) => void ): void {
    for ( let i = 0; i < this.polygons.length; i++ ) {
      const polygon = this.polygons[ i ];
      for ( let j = 0; j < polygon.length; j++ ) {
        callback( polygon[ j ], polygon[ ( j + 1 ) % polygon.length ] );
      }
    }
  }

  /**
   * Returns a singleton accumulator for this type of face. This will always return the same instance, and should ONLY
   * be used if there will be no reentrant or co-occurring usage of this accumulator (i.e. only use it when you can
   * guarantee nothing else will be clipped at the same time). If two tasks try to use this at the same time, it will
   * likely break.
   *
   * This is a method that can be called on an unknown-type face, to reproduce the same type of face. This is
   * important, since we can't feed unsorted edge data directly to a PolygonalFace's accumulator, and in general this
   * is the safest way to get an accumulator for a face.
   */
  public getScratchAccumulator(): ClippableFaceAccumulator<PolygonalFace> {
    return scratchAccumulator;
  }

  /**
   * Returns a singleton accumulator for this type of face. This will always return the same instance, and should ONLY
   * be used if there will be no reentrant or co-occurring usage of this accumulator (i.e. only use it when you can
   * guarantee nothing else will be clipped at the same time). If two tasks try to use this at the same time, it will
   * likely break.
   *
   * This should be used directly when you know you want a PolygonalFace as output. NOTE: edges SHOULD be ordered such
   * that the endPoint of the last edge is the same as the startPoint of the first edge, UNLESS a loop has been closed
   * and a polygon has been marked.
   */
  public static getScratchAccumulator(): ClippableFaceAccumulator<PolygonalFace> {
    return scratchAccumulator;
  }

  /**
   * Returns a new accumulator for this type of face. This should be used when concurrent clipping will need to happen.
   *
   * This is a method that can be called on an unknown-type face, to reproduce the same type of face. This is
   * important, since we can't feed unsorted edge data directly to a PolygonalFace's accumulator, and in general this
   * is the safest way to get an accumulator for a face.
   */
  public getAccumulator(): ClippableFaceAccumulator<PolygonalFace> {
    return new PolygonalFaceAccumulator();
  }

  /**
   * Returns a debugging string.
   */
  public toString(): string {
    return this.polygons.map( polygon => polygon.map( p => `${p.x},${p.y}` ).join( ' ' ) ).join( '\n' );
  }

  /**
   * Returns a serialized version of the face, that should be able to be deserialized into the same type of face.
   * See {FaceType}.deserialize.
   *
   * NOTE: If you don't know what type of face this is, use serializeClippableFace instead.
   */
  public serialize(): SerializedPolygonalFace {
    return {
      polygons: this.polygons.map( polygon => polygon.map( p => ( { x: p.x, y: p.y } ) ) )
    };
  }

  public static deserialize( serialized: SerializedPolygonalFace ): PolygonalFace {
    return new PolygonalFace( serialized.polygons.map( polygon => polygon.map( p => new Vector2( p.x, p.y ) ) ) );
  }

  public static fromBounds( bounds: Bounds2 ): PolygonalFace {
    return PolygonalFace.fromBoundsValues( bounds.minX, bounds.minY, bounds.maxX, bounds.maxY );
  }

  public static fromBoundsValues( minX: number, minY: number, maxX: number, maxY: number ): PolygonalFace {
    return new PolygonalFace( [ [
      new Vector2( minX, minY ),
      new Vector2( maxX, minY ),
      new Vector2( maxX, maxY ),
      new Vector2( minX, maxY )
    ] ] );
  }
}

alpenglow.register( 'PolygonalFace', PolygonalFace );

export class PolygonalFaceAccumulator implements ClippableFaceAccumulator<PolygonalFace> {

  private polygons: Vector2[][] = [];
  // TODO: try out the default of full collinear. Might hurt some performance, but might be a performance win if we are
  // TODO: creating lots of extra points
  private simplifier = new ClipSimplifier();

  public readonly usesEndPoint = false;

  public addEdge( startX: number, startY: number, endX: number, endY: number, startPoint: Vector2 | null, endPoint: Vector2 | null ): void {
    assert && assert( startX !== endX || startY !== endY, 'Points should not be identical' );

    // We'll use the simplifier to remove duplicate or walked-back points.
    // TODO: check to see if removing arbitrary collinear points helps us a lot here. It might be good, but
    // TODO: we don't want to introduce a lot of error. Probably is additional cost
    startPoint ? this.simplifier.addPoint( startPoint ) : this.simplifier.add( startX, startY );
  }

  public markNewPolygon(): void {
    this.simplifier.finalizeInto( this.polygons );
  }

  public setAccumulationBounds( minX: number, minY: number, maxX: number, maxY: number ): void {
    // no-op, since we don't use bounds
  }

  // Will reset it to the initial state also
  public finalizeFace(): PolygonalFace | null {
    if ( !this.simplifier.hasPoints() && this.polygons.length === 0 ) {
      return null;
    }

    this.simplifier.finalizeInto( this.polygons );

    const polygons = this.polygons;
    this.polygons = [];
    return polygons.length ? new PolygonalFace( polygons ) : null;
  }

  // Will reset without creating a face
  public reset(): void {
    this.polygons.length = 0;
    this.simplifier.reset();
  }
}

const scratchAccumulator = new PolygonalFaceAccumulator();

export type SerializedPolygonalFace = {
  polygons: { x: number; y: number }[][];
};