// Copyright 2023-2026, University of Colorado Boulder

/**
 * An interface for clippable/subdivide-able faces, with defined bounds and area.
 *
 * NOTE: "fake" corners are needed for some clipping operations (notably the binary line clipping operations, without
 * bounds). These are corners that are not actually part of the face, but are used when we don't have access to the
 * entire polygon, and need to output edges which will match up with other results. In these cases, we might generate
 * edges that go OUTSIDE of the resulting bounds, so if we need to access bounds of the ClippableFace, we'll need to
 * ignore these "fake" corners.
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import Bounds2 from '../../../dot/js/Bounds2.js';
import Matrix3 from '../../../dot/js/Matrix3.js';
import Range from '../../../dot/js/Range.js';
import { roundSymmetric } from '../../../dot/js/util/roundSymmetric.js';
import Vector2 from '../../../dot/js/Vector2.js';
import Shape from '../../../kite/js/Shape.js';
import IntentionalAny from '../../../phet-core/js/types/IntentionalAny.js';
import { alpenglow } from '../alpenglow.js';
import { BoundsClipping } from '../clip/BoundsClipping.js';
import { ClipSimplifier } from '../clip/ClipSimplifier.js';
import { GridClipCallback, GridClipping } from '../clip/GridClipping.js';
import { StripeClipping } from '../clip/StripeClipping.js';
import { PolygonBilinear } from '../raster/PolygonBilinear.js';
import { PolygonMitchellNetravali } from '../raster/PolygonMitchellNetravali.js';
import { LinearEdge, SerializedLinearEdge } from './LinearEdge.js';
import { solveQuadraticRootsReal } from '../../../dot/js/util/solveQuadraticRootsReal.js';

// TODO: assertions that all types of ClippableFace give the same results for the same methods

export type ClippableFace = {
  /**
   * Returns the bounds of the face (ignoring any "fake" edges, if the type supports them)
   */
  getBounds(): Bounds2;

  /**
   * Returns the range of values for the dot product of the given normal with any point contained within the face
   * (for polygons, this is the same as the range of values for the dot product of the normal with any vertex).
   */
  getDotRange( normal: Vector2 ): Range;

  /**
   * Returns the range of distances from the given point to every point along the edges of the face.
   * For instance, if the face was the unit cube, the range would be 1/2 to sqrt(2), for distances to the middles of
   * the edges and the corners respectively.
   */
  getDistanceRangeToEdges( point: Vector2 ): Range;

  /**
   * Returns the range of distances from the given point to every point inside the face. The upper bound should be
   * the same as getDistanceRangeToEdges, however the lower bound may be 0 if the point is inside the face.
   */
  getDistanceRangeToInside( point: Vector2 ): Range;

  /**
   * Returns the signed area of the face (positive if the vertices are in counter-clockwise order, negative if clockwise)
   */
  getArea(): number;

  /**
   * Returns the centroid of the face (area is required for the typical integral required to evaluate)
   */
  getCentroid( area: number ): Vector2;

  /**
   * Returns the partial for the centroid computation. These should be summed up, divided by 6, and divided by the area
   * to give the full centroid
   */
  getCentroidPartial(): Vector2;

  /**
   * Returns the evaluation of an integral that will be zero if the boundaries of the face are correctly closed.
   * It is designed so that if there is a "gap" and we have open boundaries, the result will likely be non-zero.
   *
   * NOTE: This is only used for debugging, so performance is not a concern.
   */
  getZero(): number;

  /**
   * Returns the average distance from the given point to every point inside the face. The integral evaluation requires
   * the area (similarly to the centroid computation).
   */
  getAverageDistance( point: Vector2, area: number ): number;

  /**
   * Returns the average distance from the origin to every point inside the face transformed by the given matrix.
   */
  getAverageDistanceTransformedToOrigin( transform: Matrix3, area: number ): number;

  /**
   * Returns an affine-transformed version of the face.
   */
  getTransformed( transform: Matrix3 ): ClippableFace;

  /**
   * Returns a rounded version of the face, where [-epsilon/2, epsilon/2] rounds to 0, etc.
   */
  getRounded( epsilon: number ): ClippableFace;

  /**
   * Returns a version of the face with the orientation of all of the edges swapped.
   */
  withReversedEdges(): ClippableFace;

  /**
   * Returns a copy of the face that is clipped to be within the given axis-aligned bounding box.
   *
   * TODO: consider a binary clip for this, using duality.
   */
  getClipped( minX: number, minY: number, maxX: number, maxY: number ): ClippableFace;

  /**
   * Returns two copies of the face, one that is clipped to be to the left of the given x value, and one that is
   * clipped to be to the right of the given x value.
   *
   * The fakeCornerY is used to determine the "fake" corner that is used for unsorted-edge clipping.
   */
  getBinaryXClip( x: number, fakeCornerY: number ): { minFace: ClippableFace; maxFace: ClippableFace };

  /**
   * Returns two copies of the face, one that is clipped to y values less than the given y value, and one that is
   * clipped to values greater than the given y value.
   *
   * The fakeCornerX is used to determine the "fake" corner that is used for unsorted-edge clipping.
   */
  getBinaryYClip( y: number, fakeCornerX: number ): { minFace: ClippableFace; maxFace: ClippableFace };

  /**
   * Returns two copies of the face, one that is clipped to contain points where dot( normal, point ) < value,
   * and one that is clipped to contain points where dot( normal, point ) > value.
   *
   * The fake corner perpendicular is used to determine the "fake" corner that is used for unsorted-edge clipping
   */
  getBinaryLineClip(
    normal: Vector2,
    value: number,
    fakeCornerPerpendicular: number
  ): { minFace: ClippableFace; maxFace: ClippableFace };

  /**
   * Returns an array of faces, clipped similarly to getBinaryLineClip, but with more than one (parallel) split line at
   * a time. The first face will be the one with dot( normal, point ) < values[0], the second one with
   * values[ 0 ] < dot( normal, point ) < values[1], etc.
   */
  getStripeLineClip(
    normal: Vector2,
    values: number[],
    fakeCornerPerpendicular: number
  ): ClippableFace[];

  /**
   * Returns two copies of the face, one that is clipped to contain points inside the circle defined by the given
   * center and radius, and one that is clipped to contain points outside the circle.
   *
   * NOTE: maxAngleSplit is used to determine the polygonal approximation of the circle. The returned result will not
   * have a chord with an angle greater than maxAngleSplit.
   */
  getBinaryCircularClip(
    center: Vector2,
    radius: number,
    maxAngleSplit: number
  ): { insideFace: ClippableFace; outsideFace: ClippableFace };

  /**
   * Given an integral bounding box and step sizes (which define the grid), this will clip the face to each cell in the
   * grid, calling the callback for each cell's contributing edges (in order, if we are a PolygonalFace).
   * polygonCompleteCallback will be called whenever a polygon is completed (if we are a polygonal type of face).
   */
  gridClipIterate(
    minX: number, minY: number, maxX: number, maxY: number,
    stepX: number, stepY: number, stepWidth: number, stepHeight: number,
    callback: GridClipCallback,
    polygonCompleteCallback: PolygonCompleteCallback
  ): void;

  /**
   * Returns the evaluation of the bilinear (tent) filter integrals for the given point, ASSUMING that the face
   * is clipped to the transformed unit square of x: [minX,minX+1], y: [minY,minY+1].
   */
  getBilinearFiltered( pointX: number, pointY: number, minX: number, minY: number ): number;

  /**
   * Returns the evaluation of the Mitchell-Netravali (1/3,1/3) filter integrals for the given point, ASSUMING that the
   * face is clipped to the transformed unit square of x: [minX,minX+1], y: [minY,minY+1].
   */
  getMitchellNetravaliFiltered( pointX: number, pointY: number, minX: number, minY: number ): number;

  /**
   * Returns whether the face contains the given point.
   */
  containsPoint( point: Vector2 ): boolean;

  /**
   * Converts the face to a polygonal face. Epsilon is used to determine whether start/end points match.
   *
   * NOTE: This is likely a low-performance method, and should only be used for debugging.
   */
  toPolygonalFace( epsilon?: number ): PolygonalFace;

  /**
   * Converts the face to an edged face.
   */
  toEdgedFace(): EdgedFace;

  /**
   * Converts the face to an edged-clipped face (scanning the edges, to convert bounds-side edges to counts)
   */
  toEdgedClippedFace( minX: number, minY: number, maxX: number, maxY: number ): EdgedClippedFace;

  /**
   * Converts the face to an edged-clipped face (without scanning the edges to see if they are bounds-side)
   */
  toEdgedClippedFaceWithoutCheck( minX: number, minY: number, maxX: number, maxY: number ): EdgedClippedFace;

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
  getScratchAccumulator(): ClippableFaceAccumulator;

  /**
   * Returns a new accumulator for this type of face. This should be used when concurrent clipping will need to happen.
   *
   * This is a method that can be called on an unknown-type face, to reproduce the same type of face. This is
   * important, since we can't feed unsorted edge data directly to a PolygonalFace's accumulator, and in general this
   * is the safest way to get an accumulator for a face.
   */
  getAccumulator(): ClippableFaceAccumulator;

  /**
   * Returns a Shape for the face.
   *
   * NOTE: This is likely a low-performance method, and should only be used for debugging.
   */
  getShape( epsilon?: number ): Shape;

  /**
   * Calls the callback with points for each edge in the face.
   */
  forEachEdge( callback: ( startPoint: Vector2, endPoint: Vector2 ) => void ): void;

  /**
   * Returns a debugging string.
   */
  toString(): string;

  /**
   * Returns a serialized version of the face, that should be able to be deserialized into the same type of face.
   * See {FaceType}.deserialize.
   *
   * NOTE: If you don't know what type of face this is, use serializeClippableFace instead.
   */
  serialize(): IntentionalAny;
};

/**
 * This is a type meant for building a ClippableFace (of a specific type) by adding edges, and (optionally) marking
 * where we have finished one polygon, and are now going to add edges for another polygon.
 *
 * When you are done adding edges, use finalizeFace() to get the resulting ClippableFace. If there is no data that gives
 * a non-zero area face, it will return null. This will also reset the internal state, so it can be used to create a
 * fresh new face.
 */
export type ClippableFaceAccumulator<FaceType extends ClippableFace = ClippableFace> = {
  /**
   * Adds an edge to the face.
   *
   * NOTE: It has raw numbers AND an optional Vector2 form. This is to support minimizing garbage collection, so that
   * if we already have a Vector2 that we should use, we'll use it. Otherwise the actual number values will be used.
   * (IF passing both, they should be precisely equal!).
   */
  addEdge(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    startPoint: Vector2 | null,
    endPoint: Vector2 | null
  ): void;

  /**
   * Marks a point where previous edges belonged to other polygons, and addEdges after this call will belong to a new
   * polygon.
   *
   * This is important for polygonal data, where the start/end points will need to match up, EXCEPT for when we
   * transition to a new polygon ("subpath").
   */
  markNewPolygon(): void;

  /**
   * A performance marker, such that if this is false, the user can provide arbitrary data to endX/endY/endPoint and
   * it won't matter. This is primarily for polygonal data, where we don't want to require computing the end-data
   * since it will only use the start point of each edge.
   */
  usesEndPoint: boolean;

  /**
   * We'll want to mark the bounds of a face, if it's coming from particular types of clipping data.
   * This is important for proper construction of an EdgedClippedFace.
   */
  setAccumulationBounds( minX: number, minY: number, maxX: number, maxY: number ): void;

  /**
   * Should return a ClippableFace of the given type (IF it is not just a trivial/degenerate non-zero case).
   *
   * Resets the state of the accumulator so that it is ready to receive data for a new ClippableFace. So it will
   * expect a pattern of:
   *
   * accumulator.addEdge( ... );
   * accumulator.addEdge( ... );
   * accumulator.addEdge( ... );
   * accumulator.markNewPolygon();
   * accumulator.addEdge( ... );
   * accumulator.addEdge( ... );
   * accumulator.addEdge( ... );
   * accumulator.markNewPolygon();
   * const face1 = accumulator.finalizeFace();
   *
   * accumulator.addEdge( ... );
   * accumulator.addEdge( ... );
   * accumulator.addEdge( ... );
   * accumulator.markNewPolygon();
   * const face2 = accumulator.finalizeFace();
   */
  finalizeFace(): FaceType | null;

  /**
   * Resets the state of the accumulator so it's ready to receive data for a new face. This should be used if we want to
   * abandon the already-provided data.
   */
  reset(): void;
};

export type SerializedClippableFace = {
  type: 'PolygonalFace';
  face: SerializedPolygonalFace;
} | {
  type: 'EdgedFace';
  face: SerializedEdgedFace;
};

export const serializeClippableFace = ( clippableFace: ClippableFace ): SerializedClippableFace => {
  assert && assert( clippableFace instanceof PolygonalFace || clippableFace instanceof EdgedFace );

  return {
    type: clippableFace instanceof PolygonalFace ? 'PolygonalFace' : 'EdgedFace',
    face: clippableFace.serialize()
  };
};

export const deserializeClippableFace = ( serialized: SerializedClippableFace ): ClippableFace => {
  return serialized.type === 'PolygonalFace' ? PolygonalFace.deserialize( serialized.face ) : EdgedFace.deserialize( serialized.face );
};


const scratchVectorA = new Vector2( 0, 0 );
const scratchVectorB = new Vector2( 0, 0 );
const scratchVectorC = new Vector2( 0, 0 );
const scratchVectorD = new Vector2( 0, 0 );

const emptyArray: LinearEdge[] = [];

/**
 * A ClippableFace based on a set of line segment edges. Should still represent multiple closed loops, but it is not
 * explicit.
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */
export class EdgedFace implements ClippableFace {
  public constructor( public readonly edges: LinearEdge[], skipValidation = false ) {
    // Check on validating edges, since our binary clips won't work well if things aren't matched up (can get extra
    // edges).
    assertSlow && !skipValidation && LinearEdge.validateStartEndMatches( edges );
  }

  /**
   * Converts the face to a polygonal face. Epsilon is used to determine whether start/end points match.
   *
   * NOTE: This is likely a low-performance method, and should only be used for debugging.
   */
  public toPolygonalFace( epsilon = 1e-8 ): PolygonalFace {
    return new PolygonalFace( LinearEdge.toPolygons( this.edges, epsilon ) );
  }

  /**
   * Converts the face to an edged face.
   */
  public toEdgedFace(): EdgedFace {
    return this;
  }

  /**
   * Converts the face to a edged-clipped face (scanning the edges, to convert bounds-side edges to counts)
   */
  public toEdgedClippedFace( minX: number, minY: number, maxX: number, maxY: number ): EdgedClippedFace {
    return EdgedClippedFace.fromEdges( this.edges, minX, minY, maxX, maxY );
  }

  /**
   * Converts the face to a edged-clipped face (without scanning the edges to see if they are bounds-side)
   */
  public toEdgedClippedFaceWithoutCheck( minX: number, minY: number, maxX: number, maxY: number ): EdgedClippedFace {
    return EdgedClippedFace.fromEdgesWithoutCheck( this.edges, minX, minY, maxX, maxY );
  }

  /**
   * Returns a Shape for the face.
   *
   * NOTE: This is likely a low-performance method, and should only be used for debugging.
   */
  public getShape( epsilon = 1e-8 ): Shape {
    return this.toPolygonalFace( epsilon ).getShape();
  }

  /**
   * Returns the bounds of the face (ignoring any "fake" edges, if the type supports them)
   */
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

  /**
   * Returns the range of values for the dot product of the given normal with any point contained within the face
   * (for polygons, this is the same as the range of values for the dot product of the normal with any vertex).
   */
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

  /**
   * Returns the range of distances from the given point to every point along the edges of the face.
   * For instance, if the face was the unit cube, the range would be 1/2 to sqrt(2), for distances to the middles of
   * the edges and the corners respectively.
   */
  public getDistanceRangeToEdges( point: Vector2 ): Range {
    let min = Number.POSITIVE_INFINITY;
    let max = 0;

    // TODO: Use LinearEdge.addDistanceRange if the function-call overhead isn't too much
    for ( let i = 0; i < this.edges.length; i++ ) {
      const edge = this.edges[ i ];

      const p0x = edge.startPoint.x - point.x;
      const p0y = edge.startPoint.y - point.y;
      const p1x = edge.endPoint.x - point.x;
      const p1y = edge.endPoint.y - point.y;

      min = Math.min( min, LinearEdge.evaluateClosestDistanceToOrigin( p0x, p0y, p1x, p1y ) );
      max = Math.max( max, Math.sqrt( p0x * p0x + p0y * p0y ), Math.sqrt( p1x * p1x + p1y * p1y ) );
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
    for ( let i = 0; i < this.edges.length; i++ ) {
      const edge = this.edges[ i ];

      const p0 = edge.startPoint;
      const p1 = edge.endPoint;

      // Shoelace formula for the area
      // NOTE NOTE NOTE: Don't change this without changing EdgedClippedFace's getArea()!
      area += ( p1.x + p0.x ) * ( p1.y - p0.y );
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

    for ( let i = 0; i < this.edges.length; i++ ) {
      const edge = this.edges[ i ];

      const p0 = edge.startPoint;
      const p1 = edge.endPoint;

      // Partial centroid evaluation. NOTE: using the compound version here, for performance/stability tradeoffs
      // NOTE NOTE NOTE: Don't change this without changing EdgedClippedFace's getCentroidPartial()!
      const base = ( p0.x * ( 2 * p0.y + p1.y ) + p1.x * ( p0.y + 2 * p1.y ) );
      x += ( p0.x - p1.x ) * base;
      y += ( p1.y - p0.y ) * base;
    }

    return new Vector2( x, y );
  }

  /**
   * Returns the centroid of the face (area is required for the typical integral required to evaluate)
   */
  public getCentroid( area: number ): Vector2 {
    return this.getCentroidPartial().timesScalar( 1 / ( 6 * area ) );
  }

  /**
   * Returns the evaluation of an integral that will be zero if the boundaries of the face are correctly closed.
   * It is designed so that if there is a "gap" and we have open boundaries, the result will likely be non-zero.
   *
   * NOTE: This is only used for debugging, so performance is not a concern.
   */
  public getZero(): number {
    return _.sum( this.edges.map( e => e.getLineIntegralZero() ) );
  }

  /**
   * Returns the average distance from the given point to every point inside the face. The integral evaluation requires
   * the area (similarly to the centroid computation).
   */
  public getAverageDistance( point: Vector2, area: number ): number {
    let sum = 0;

    for ( let i = 0; i < this.edges.length; i++ ) {
      const edge = this.edges[ i ];

      const p0 = edge.startPoint;
      const p1 = edge.endPoint;

      sum += LinearEdge.evaluateLineIntegralDistance(
        p0.x - point.x,
        p0.y - point.y,
        p1.x - point.x,
        p1.y - point.y
      );
    }

    return sum / area;
  }

  /**
   * Returns the average distance from the origin to every point inside the face transformed by the given matrix.
   */
  public getAverageDistanceTransformedToOrigin( transform: Matrix3, area: number ): number {
    let sum = 0;

    for ( let i = 0; i < this.edges.length; i++ ) {
      const edge = this.edges[ i ];

      const p0 = transform.multiplyVector2( scratchVectorA.set( edge.startPoint ) );
      const p1 = transform.multiplyVector2( scratchVectorB.set( edge.endPoint ) );

      sum += LinearEdge.evaluateLineIntegralDistance( p0.x, p0.y, p1.x, p1.y );
    }

    // We need to account for how much the transform will scale the area
    return sum / ( area * transform.getSignedScale() );
  }

  /**
   * Returns a copy of the face that is clipped to be within the given axis-aligned bounding box.
   */
  public getClipped( minX: number, minY: number, maxX: number, maxY: number ): EdgedFace {
    const edges: LinearEdge[] = [];

    const centerX = ( minX + maxX ) / 2;
    const centerY = ( minY + maxY ) / 2;

    for ( let i = 0; i < this.edges.length; i++ ) {
      const edge = this.edges[ i ];
      BoundsClipping.boundsClipEdge(
        edge.startPoint, edge.endPoint,
        minX, minY, maxX, maxY, centerX, centerY,
        edges
      );
    }

    return new EdgedFace( edges );
  }

  /**
   * Returns two copies of the face, one that is clipped to be to the left of the given x value, and one that is
   * clipped to be to the right of the given x value.
   *
   * The fakeCornerY is used to determine the "fake" corner that is used for unsorted-edge clipping.
   */
  public getBinaryXClip( x: number, fakeCornerY: number ): { minFace: EdgedFace; maxFace: EdgedFace } {
    const minEdges: LinearEdge[] = [];
    const maxEdges: LinearEdge[] = [];

    for ( let i = 0; i < this.edges.length; i++ ) {
      const edge = this.edges[ i ];

      BinaryClipping.binaryXClipEdge( edge.startPoint, edge.endPoint, x, fakeCornerY, minEdges, maxEdges );
    }

    assert && assert( minEdges.every( e => e.startPoint.x <= x && e.endPoint.x <= x ) );
    assert && assert( maxEdges.every( e => e.startPoint.x >= x && e.endPoint.x >= x ) );

    return {
      minFace: new EdgedFace( minEdges ),
      maxFace: new EdgedFace( maxEdges )
    };
  }

  /**
   * Returns two copies of the face, one that is clipped to y values less than the given y value, and one that is
   * clipped to values greater than the given y value.
   *
   * The fakeCornerX is used to determine the "fake" corner that is used for unsorted-edge clipping.
   */
  public getBinaryYClip( y: number, fakeCornerX: number ): { minFace: EdgedFace; maxFace: EdgedFace } {
    const minEdges: LinearEdge[] = [];
    const maxEdges: LinearEdge[] = [];

    for ( let i = 0; i < this.edges.length; i++ ) {
      const edge = this.edges[ i ];

      BinaryClipping.binaryYClipEdge( edge.startPoint, edge.endPoint, y, fakeCornerX, minEdges, maxEdges );
    }

    assert && assert( minEdges.every( e => e.startPoint.y <= y && e.endPoint.y <= y ) );
    assert && assert( maxEdges.every( e => e.startPoint.y >= y && e.endPoint.y >= y ) );

    return {
      minFace: new EdgedFace( minEdges ),
      maxFace: new EdgedFace( maxEdges )
    };
  }

  /**
   * Returns two copies of the face, one that is clipped to contain points where dot( normal, point ) < value,
   * and one that is clipped to contain points where dot( normal, point ) > value.
   *
   * The fake corner perpendicular is used to determine the "fake" corner that is used for unsorted-edge clipping
   */
  public getBinaryLineClip( normal: Vector2, value: number, fakeCornerPerpendicular: number ): { minFace: EdgedFace; maxFace: EdgedFace } {
    const minEdges: LinearEdge[] = [];
    const maxEdges: LinearEdge[] = [];

    for ( let i = 0; i < this.edges.length; i++ ) {
      const edge = this.edges[ i ];

      BinaryClipping.binaryLineClipEdge( edge.startPoint, edge.endPoint, normal, value, fakeCornerPerpendicular, minEdges, maxEdges );
    }

    assert && assert( minEdges.every( e => normal.dot( e.startPoint ) <= value + 1e-8 && normal.dot( e.endPoint ) <= value + 1e-8 ) );
    assert && assert( maxEdges.every( e => normal.dot( e.startPoint ) >= value - 1e-8 && normal.dot( e.endPoint ) >= value - 1e-8 ) );

    return {
      minFace: new EdgedFace( minEdges ),
      maxFace: new EdgedFace( maxEdges )
    };
  }

  /**
   * Returns an array of faces, clipped similarly to getBinaryLineClip, but with more than one (parallel) split line at
   * a time. The first face will be the one with dot( normal, point ) < values[0], the second one with
   * values[ 0 ] < dot( normal, point ) < values[1], etc.
   */
  public getStripeLineClip( normal: Vector2, values: number[], fakeCornerPerpendicular: number ): EdgedFace[] {
    if ( values.length === 0 ) {
      return [ this ];
    }

    const edgesCollection: LinearEdge[][] = _.range( values.length + 1 ).map( () => [] );

    for ( let i = 0; i < this.edges.length; i++ ) {
      const edge = this.edges[ i ];

      StripeClipping.binaryStripeClipEdge( edge.startPoint, edge.endPoint, normal, values, fakeCornerPerpendicular, edgesCollection );
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

  /**
   * Returns two copies of the face, one that is clipped to contain points inside the circle defined by the given
   * center and radius, and one that is clipped to contain points outside the circle.
   *
   * NOTE: maxAngleSplit is used to determine the polygonal approximation of the circle. The returned result will not
   * have a chord with an angle greater than maxAngleSplit.
   */
  public getBinaryCircularClip( center: Vector2, radius: number, maxAngleSplit: number ): { insideFace: EdgedFace; outsideFace: EdgedFace } {
    const insideEdges: LinearEdge[] = [];
    const outsideEdges: LinearEdge[] = [];

    CircularClipping.binaryCircularClipEdges( this.edges, center, radius, maxAngleSplit, insideEdges, outsideEdges );

    return {
      insideFace: new EdgedFace( insideEdges ),
      outsideFace: new EdgedFace( outsideEdges )
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
    for ( let i = 0; i < this.edges.length; i++ ) {
      const edge = this.edges[ i ];

      GridClipping.gridClipIterate(
        edge.startPoint, edge.endPoint,
        minX, minY, maxX, maxY,
        stepX, stepY, stepWidth, stepHeight,
        callback
      );
    }

    if ( this.edges.length ) {
      polygonCompleteCallback();
    }
  }

  /**
   * Returns the evaluation of the bilinear (tent) filter integrals for the given point, ASSUMING that the face
   * is clipped to the transformed unit square of x: [minX,minX+1], y: [minY,minY+1].
   */
  public getBilinearFiltered( pointX: number, pointY: number, minX: number, minY: number ): number {
    return PolygonBilinear.evaluateLinearEdges( this.edges, pointX, pointY, minX, minY );
  }

  /**
   * Returns the evaluation of the Mitchell-Netravali (1/3,1/3) filter integrals for the given point, ASSUMING that the
   * face is clipped to the transformed unit square of x: [minX,minX+1], y: [minY,minY+1].
   */
  public getMitchellNetravaliFiltered( pointX: number, pointY: number, minX: number, minY: number ): number {
    return PolygonMitchellNetravali.evaluateLinearEdges( this.edges, pointX, pointY, minX, minY );
  }

  /**
   * Returns whether the face contains the given point.
   */
  public containsPoint( point: Vector2 ): boolean {
    return LinearEdge.getWindingNumberEdges( this.edges, point ) !== 0;
  }

  /**
   * Returns an affine-transformed version of the face.
   */
  public getTransformed( transform: Matrix3 ): EdgedFace {
    if ( transform.isIdentity() ) {
      return this;
    }
    else {
      const transformedEdges: LinearEdge[] = [];

      for ( let i = 0; i < this.edges.length; i++ ) {
        const edge = this.edges[ i ];

        const start = transform.timesVector2( edge.startPoint );
        const end = transform.timesVector2( edge.endPoint );

        if ( !start.equals( end ) ) {
          transformedEdges.push( new LinearEdge( start, end ) );
        }
      }

      return new EdgedFace( transformedEdges );
    }
  }

  /**
   * Returns a rounded version of the face, where [-epsilon/2, epsilon/2] rounds to 0, etc.
   */
  public getRounded( epsilon: number ): EdgedFace {
    const edges = [];

    for ( let i = 0; i < this.edges.length; i++ ) {
      const edge = this.edges[ i ];

      const startPoint = new Vector2(
        roundSymmetric( edge.startPoint.x / epsilon ) * epsilon,
        roundSymmetric( edge.startPoint.y / epsilon ) * epsilon
      );

      const endPoint = new Vector2(
        roundSymmetric( edge.endPoint.x / epsilon ) * epsilon,
        roundSymmetric( edge.endPoint.y / epsilon ) * epsilon
      );

      if ( !startPoint.equals( endPoint ) ) {
        edges.push( new LinearEdge( startPoint, endPoint, edge.containsFakeCorner ) );
      }
    }

    return new EdgedFace( edges );
  }

  /**
   * Returns a version of the face with the orientation of all of the edges swapped.
   */
  public withReversedEdges(): EdgedFace {
    return new EdgedFace(
      this.edges.map( edge => new LinearEdge( edge.endPoint, edge.startPoint ) ).reverse()
    );
  }

  /**
   * Calls the callback with points for each edge in the face.
   */
  public forEachEdge( callback: ( startPoint: Vector2, endPoint: Vector2 ) => void ): void {
    for ( let i = 0; i < this.edges.length; i++ ) {
      const edge = this.edges[ i ];
      callback( edge.startPoint, edge.endPoint );
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
  public getScratchAccumulator(): ClippableFaceAccumulator<EdgedFace> {
    return edgedFaceScratchAccumulator;
  }

  /**
   * Returns a singleton accumulator for this type of face. This will always return the same instance, and should ONLY
   * be used if there will be no reentrant or co-occurring usage of this accumulator (i.e. only use it when you can
   * guarantee nothing else will be clipped at the same time). If two tasks try to use this at the same time, it will
   * likely break.
   *
   * This should be used directly when you know you want an EdgedFace as output.
   */
  public static getScratchAccumulator(): ClippableFaceAccumulator<EdgedFace> {
    return edgedFaceScratchAccumulator;
  }

  /**
   * Returns a new accumulator for this type of face. This should be used when concurrent clipping will need to happen.
   *
   * This is a method that can be called on an unknown-type face, to reproduce the same type of face. This is
   * important, since we can't feed unsorted edge data directly to a PolygonalFace's accumulator, and in general this
   * is the safest way to get an accumulator for a face.
   */
  public getAccumulator(): ClippableFaceAccumulator<EdgedFace> {
    return new EdgedFaceAccumulator();
  }

  /**
   * Returns a debugging string.
   */
  public toString(): string {
    return this.edges.map( e => `${e.startPoint.x},${e.startPoint.y} => ${e.endPoint.x},${e.endPoint.y}` ).join( '\n' );
  }

  /**
   * Returns a serialized version of the face, that should be able to be deserialized into the same type of face.
   * See {FaceType}.deserialize.
   *
   * NOTE: If you don't know what type of face this is, use serializeClippableFace instead.
   */
  public serialize(): SerializedEdgedFace {
    return {
      edges: this.edges.map( edge => edge.serialize() )
    };
  }

  public static deserialize( serialized: SerializedEdgedFace ): EdgedFace {
    return new EdgedFace( serialized.edges.map( edge => LinearEdge.deserialize( edge ) ) );
  }

  public static fromBounds( bounds: Bounds2 ): EdgedFace {
    return EdgedFace.fromBoundsValues( bounds.minX, bounds.minY, bounds.maxX, bounds.maxY );
  }

  public static fromBoundsValues( minX: number, minY: number, maxX: number, maxY: number ): EdgedFace {
    const p0 = new Vector2( minX, minY );
    const p1 = new Vector2( maxX, minY );
    const p2 = new Vector2( maxX, maxY );
    const p3 = new Vector2( minX, maxY );

    return new EdgedFace( [
      new LinearEdge( p0, p1 ),
      new LinearEdge( p1, p2 ),
      new LinearEdge( p2, p3 ),
      new LinearEdge( p3, p0 )
    ] );
  }
}

alpenglow.register( 'EdgedFace', EdgedFace );

export class EdgedFaceAccumulator implements ClippableFaceAccumulator<EdgedFace> {

  private edges: LinearEdge[] = [];

  public readonly usesEndPoint = true;

  public addEdge( startX: number, startY: number, endX: number, endY: number, startPoint: Vector2 | null, endPoint: Vector2 | null ): void {
    assert && assert( startX !== endX || startY !== endY, 'Points should not be identical' );

    this.edges.push( new LinearEdge(
      startPoint || new Vector2( startX, startY ),
      endPoint || new Vector2( endX, endY )
    ) );
  }

  public markNewPolygon(): void {
    // no-op, since we're storing unsorted edges!
  }

  public setAccumulationBounds( minX: number, minY: number, maxX: number, maxY: number ): void {
    // no-op, since we don't use bounds
  }

  // Will reset it to the initial state also
  public finalizeFace(): EdgedFace | null {
    if ( this.edges.length === 0 ) {
      return null;
    }

    const edges = this.edges;
    this.edges = [];
    return new EdgedFace( edges );
  }

  // Will reset without creating a face
  public reset(): void {
    this.edges.length = 0;
  }
}

const edgedFaceScratchAccumulator = new EdgedFaceAccumulator();

export type SerializedEdgedFace = {
  edges: SerializedLinearEdge[];
};

/**
 * A ClippableFace based on a set of line segment edges, where (a) it is contained within a bounding box, and (b)
 * line segments going along the full border of the bounding box (from one corner to another) will be counted
 * separately. This helps with performance, since EdgedFace on its own would build up large counts of these edges
 * that "undo" each other during recursive clipping operations.
 *
 * Should still represent multiple closed loops, but it is not explicit.
 *
 * "implicit" edges/vertices are those defined by the clipped counts (minXCount, etc.)
 * "explicit" edges/vertices are those in the edges list
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */
export class EdgedClippedFace implements ClippableFace {

  public readonly clippedEdgedFace: EdgedFace;

  public constructor(
    // Should contain only "internal" edges, not those clipped edges that are corner-to-corner along the edge of the
    // bounding box.
    public readonly edges: LinearEdge[],

    // Bounding box
    public readonly minX: number,
    public readonly minY: number,
    public readonly maxX: number,
    public readonly maxY: number,

    // Count of edges from (minX,minY) to (minX,maxY) minus count of edges from (minX,maxY) to (minX,minY)
    // (minX, minY=>maxY positive)
    public readonly minXCount: number,

    // Count of edges from (minX,minY) to (maxX,minY) minus count of edges from (maxX,minY) to (minX,minY)
    // (minX=>maxX positive, minY)
    public readonly minYCount: number,

    // Count of edges from (maxX,minY) to (maxX,maxY) minus count of edges from (maxX,maxY) to (maxX,minY)
    // (maxX, minY=>maxY positive)
    public readonly maxXCount: number,

    // Count of edges from (minX,maxY) to (maxX,maxY) minus count of edges from (maxX,maxY) to (minX,maxY)
    // (minX=>maxX positive, maxY)
    public readonly maxYCount: number
  ) {
    assert && assert( isFinite( minX ) && isFinite( maxX ) && minX <= maxX );
    assert && assert( isFinite( minY ) && isFinite( maxY ) && minY <= maxY );
    assert && assert( isFinite( minXCount ) && Number.isInteger( minXCount ) );
    assert && assert( isFinite( minYCount ) && Number.isInteger( minYCount ) );
    assert && assert( isFinite( maxXCount ) && Number.isInteger( maxXCount ) );
    assert && assert( isFinite( maxYCount ) && Number.isInteger( maxYCount ) );

    assertSlow && assertSlow( edges.every( edge => {
      return edge.startPoint.x >= minX - 1e-8 && edge.startPoint.x <= maxX + 1e-8 &&
             edge.startPoint.y >= minY - 1e-8 && edge.startPoint.y <= maxY + 1e-8 &&
             edge.endPoint.x >= minX - 1e-8 && edge.endPoint.x <= maxX + 1e-8 &&
             edge.endPoint.y >= minY - 1e-8 && edge.endPoint.y <= maxY + 1e-8;
    } ) );

    this.clippedEdgedFace = new EdgedFace( edges, true );

    // Check on validating edges, since our binary clips won't work well if things aren't matched up (can get extra
    // edges).
    assertSlow && LinearEdge.validateStartEndMatches( this.getAllEdges() );
  }

  // TODO: also have FAST conversions to here, where we DO NOT scan those edges?

  /**
   * Converts the face to a polygonal face. Epsilon is used to determine whether start/end points match.
   *
   * NOTE: This is likely a low-performance method, and should only be used for debugging.
   */
  public toPolygonalFace( epsilon = 1e-8 ): PolygonalFace {
    // We'll need to add in our counted edges
    return this.toEdgedFace().toPolygonalFace( epsilon );
  }

  /**
   * Converts the face to an edged face.
   */
  public toEdgedFace(): EdgedFace {
    return new EdgedFace( this.getAllEdges() );
  }

  /**
   * Converts the face to a edged-clipped face (scanning the edges, to convert bounds-side edges to counts)
   */
  public toEdgedClippedFace( minX: number, minY: number, maxX: number, maxY: number ): EdgedClippedFace {
    if ( this.minX === minX && this.minY === minY && this.maxX === maxX && this.maxY === maxY ) {
      return this;
    }
    else {
      return EdgedClippedFace.fromEdges( this.getAllEdges(), minX, minY, maxX, maxY );
    }
  }

  /**
   * Converts the face to a edged-clipped face (without scanning the edges to see if they are bounds-side)
   */
  public toEdgedClippedFaceWithoutCheck( minX: number, minY: number, maxX: number, maxY: number ): EdgedClippedFace {
    if ( this.minX === minX && this.minY === minY && this.maxX === maxX && this.maxY === maxY ) {
      return this;
    }
    else {
      return EdgedClippedFace.fromEdgesWithoutCheck( this.getAllEdges(), minX, minY, maxX, maxY );
    }
  }

  public static fromEdges( edges: LinearEdge[], minX: number, minY: number, maxX: number, maxY: number ): EdgedClippedFace {
    // TODO: both of these clear some things, get rid of inefficiency?
    edgedClippedScratchAccumulator.reset();
    edgedClippedScratchAccumulator.setAccumulationBounds( minX, minY, maxX, maxY );
    for ( let i = 0; i < edges.length; i++ ) {
      const edge = edges[ i ];
      edgedClippedScratchAccumulator.addEdge( edge.startPoint.x, edge.startPoint.y, edge.endPoint.x, edge.endPoint.y, edge.startPoint, edge.endPoint );
    }

    return edgedClippedScratchAccumulator.finalizeEnsureFace( minX, minY, maxX, maxY );
  }

  public static fromEdgesWithoutCheck( edges: LinearEdge[], minX: number, minY: number, maxX: number, maxY: number ): EdgedClippedFace {
    return new EdgedClippedFace( edges, minX, minY, maxX, maxY, 0, 0, 0, 0 );
  }

  private static implicitEdge( startPoint: Vector2, endPoint: Vector2, count: number ): LinearEdge {
    assert && assert( count !== 0 );
    return new LinearEdge(
      count > 0 ? startPoint : endPoint,
      count > 0 ? endPoint : startPoint
    );
  }

  public forEachImplicitEdge( callback: ( startPoint: Vector2, endPoint: Vector2 ) => void ): void {
    const minXMinY = ( this.minXCount || this.minYCount ) ? this.getMinXMinY() : null;
    const minXMaxY = ( this.minXCount || this.maxYCount ) ? this.getMinXMaxY() : null;
    const maxXMinY = ( this.maxXCount || this.minYCount ) ? this.getMaxXMinY() : null;
    const maxXMaxY = ( this.maxXCount || this.maxYCount ) ? this.getMaxXMaxY() : null;

    for ( let i = 0; i !== this.minXCount; i += Math.sign( this.minXCount ) ) {
      assert && assert( minXMinY && minXMaxY );
      this.minXCount > 0 ? callback( minXMinY!, minXMaxY! ) : callback( minXMaxY!, minXMinY! );
    }
    for ( let i = 0; i !== this.minYCount; i += Math.sign( this.minYCount ) ) {
      assert && assert( minXMinY && maxXMinY );
      this.minYCount > 0 ? callback( minXMinY!, maxXMinY! ) : callback( maxXMinY!, minXMinY! );
    }
    for ( let i = 0; i !== this.maxXCount; i += Math.sign( this.maxXCount ) ) {
      assert && assert( maxXMinY && maxXMaxY );
      this.maxXCount > 0 ? callback( maxXMinY!, maxXMaxY! ) : callback( maxXMaxY!, maxXMinY! );
    }
    for ( let i = 0; i !== this.maxYCount; i += Math.sign( this.maxYCount ) ) {
      assert && assert( minXMaxY && maxXMaxY );
      this.maxYCount > 0 ? callback( minXMaxY!, maxXMaxY! ) : callback( maxXMaxY!, minXMaxY! );
    }
  }

  public getImplicitEdges(): LinearEdge[] {
    const edges: LinearEdge[] = [];

    this.forEachImplicitEdge( ( startPoint, endPoint ) => edges.push( new LinearEdge( startPoint, endPoint ) ) );

    return edges;
  }

  public getAllEdges(): LinearEdge[] {
    return [
      ...this.edges,
      ...this.getImplicitEdges()
    ];
  }

  /**
   * Returns a Shape for the face.
   *
   * NOTE: This is likely a low-performance method, and should only be used for debugging.
   */
  public getShape( epsilon = 1e-8 ): Shape {
    return this.toPolygonalFace( epsilon ).getShape();
  }

  public getMinXMinY(): Vector2 {
    return new Vector2( this.minX, this.minY );
  }

  public getMinXMaxY(): Vector2 {
    return new Vector2( this.minX, this.maxY );
  }

  public getMaxXMinY(): Vector2 {
    return new Vector2( this.maxX, this.minY );
  }

  public getMaxXMaxY(): Vector2 {
    return new Vector2( this.maxX, this.maxY );
  }

  /**
   * Returns whether this face has an implicit vertex at the minX-minY corner.
   */
  public hasMinXMinY(): boolean {
    return this.minXCount !== 0 || this.minYCount !== 0;
  }

  /**
   * Returns whether this face has an implicit vertex at the minX-maxY corner.
   */
  public hasMinXMaxY(): boolean {
    return this.minXCount !== 0 || this.maxYCount !== 0;
  }

  /**
   * Returns whether this face has an implicit vertex at the maxX-minY corner.
   */
  public hasMaxXMinY(): boolean {
    return this.maxXCount !== 0 || this.minYCount !== 0;
  }

  /**
   * Returns whether this face has an implicit vertex at the maxX-maxY corner.
   */
  public hasMaxXMaxY(): boolean {
    return this.maxXCount !== 0 || this.maxYCount !== 0;
  }

  /**
   * Returns whether this face has an implicit vertex with minX.
   */
  public hasMinX(): boolean {
    return this.minXCount !== 0 || this.minYCount !== 0 || this.maxYCount !== 0;
  }

  /**
   * Returns whether this face has an implicit vertex with minY.
   */
  public hasMinY(): boolean {
    return this.minYCount !== 0 || this.minXCount !== 0 || this.maxXCount !== 0;
  }

  /**
   * Returns whether this face has an implicit vertex with maxX.
   */
  public hasMaxX(): boolean {
    return this.maxXCount !== 0 || this.minYCount !== 0 || this.maxYCount !== 0;
  }

  /**
   * Returns whether this face has an implicit vertex with maxY.
   */
  public hasMaxY(): boolean {
    return this.maxYCount !== 0 || this.minXCount !== 0 || this.maxXCount !== 0;
  }

  /**
   * Returns the bounds of the face (ignoring any "fake" edges, if the type supports them)
   */
  public getBounds(): Bounds2 {
    const result = this.clippedEdgedFace.getBounds();

    this.hasMinX() && result.addX( this.minX );
    this.hasMinY() && result.addY( this.minY );
    this.hasMaxX() && result.addX( this.maxX );
    this.hasMaxY() && result.addY( this.maxY );

    return result;
  }

  /**
   * Returns the range of values for the dot product of the given normal with any point contained within the face
   * (for polygons, this is the same as the range of values for the dot product of the normal with any vertex).
   */
  public getDotRange( normal: Vector2 ): Range {
    const range = this.clippedEdgedFace.getDotRange( normal );

    this.hasMinXMinY() && range.addValue( normal.x * this.minX + normal.y * this.minY );
    this.hasMinXMaxY() && range.addValue( normal.x * this.minX + normal.y * this.maxY );
    this.hasMaxXMinY() && range.addValue( normal.x * this.maxX + normal.y * this.minY );
    this.hasMaxXMaxY() && range.addValue( normal.x * this.maxX + normal.y * this.maxY );

    return range;
  }

  /**
   * Returns the range of distances from the given point to every point along the edges of the face.
   * For instance, if the face was the unit cube, the range would be 1/2 to sqrt(2), for distances to the middles of
   * the edges and the corners respectively.
   */
  public getDistanceRangeToEdges( point: Vector2 ): Range {
    const range = this.clippedEdgedFace.getDistanceRangeToEdges( point );

    this.minXCount && LinearEdge.addDistanceRange( this.getMinXMinY(), this.getMinXMaxY(), point, range );
    this.minYCount && LinearEdge.addDistanceRange( this.getMinXMinY(), this.getMaxXMinY(), point, range );
    this.maxXCount && LinearEdge.addDistanceRange( this.getMaxXMinY(), this.getMaxXMaxY(), point, range );
    this.maxYCount && LinearEdge.addDistanceRange( this.getMinXMaxY(), this.getMaxXMaxY(), point, range );

    return range;
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
    let area = this.clippedEdgedFace.getArea();

    // NOTE: This ASSUMES that we're using the specific shoelace formulation of ( p1.x + p0.x ) * ( p1.y - p0.y ) in
    // the super call.
    // Our minYCount/maxYCount won't contribute (since they have the same Y values, their shoelace contribution will be
    // zero.
    // ALSO: there is a doubling and non-doubling that cancel out here (1/2 from shoelace, 2* due to x+x).
    area += ( this.maxY - this.minY ) * ( this.minXCount * this.minX + this.maxXCount * this.maxX );

    return area;
  }

  /**
   * Returns the partial for the centroid computation. These should be summed up, divided by 6, and divided by the area
   * to give the full centroid
   */
  public getCentroidPartial(): Vector2 {
    const centroidPartial = this.clippedEdgedFace.getCentroidPartial();

    // NOTE: This ASSUMES we're using the compound formulation, based on
    // xc = ( p0.x - p1.x ) * ( p0.x * ( 2 * p0.y + p1.y ) + p1.x * ( p0.y + 2 * p1.y ) )
    // yc = ( p1.y - p0.y ) * ( p0.x * ( 2 * p0.y + p1.y ) + p1.x * ( p0.y + 2 * p1.y ) )
    if ( this.minYCount || this.maxYCount ) {
      centroidPartial.x += 3 * ( this.minX - this.maxX ) * ( this.minX + this.maxX ) * ( this.minYCount * this.minY + this.maxYCount * this.maxY );
    }
    if ( this.minXCount || this.maxXCount ) {
      centroidPartial.y += 3 * ( this.maxY - this.minY ) * ( this.minY + this.maxY ) * ( this.minXCount * this.minX + this.maxXCount * this.maxX );
    }

    return centroidPartial;
  }

  /**
   * Returns the centroid of the face (area is required for the typical integral required to evaluate)
   */
  public getCentroid( area: number ): Vector2 {
    return this.getCentroidPartial().timesScalar( 1 / ( 6 * area ) );
  }

  /**
   * Returns the evaluation of an integral that will be zero if the boundaries of the face are correctly closed.
   * It is designed so that if there is a "gap" and we have open boundaries, the result will likely be non-zero.
   *
   * NOTE: This is only used for debugging, so performance is not a concern.
   */
  public getZero(): number {
    return _.sum( this.getAllEdges().map( e => e.getLineIntegralZero() ) );
  }

  /**
   * Returns the average distance from the given point to every point inside the face. The integral evaluation requires
   * the area (similarly to the centroid computation).
   */
  public getAverageDistance( point: Vector2, area: number ): number {
    let average = this.clippedEdgedFace.getAverageDistance( point, area );

    const minX = this.minX - point.x;
    const minY = this.minY - point.y;
    const maxX = this.maxX - point.x;
    const maxY = this.maxY - point.y;

    if ( this.minXCount ) {
      average += this.minXCount * LinearEdge.evaluateLineIntegralDistance( minX, minY, minX, maxY ) / area;
    }
    if ( this.minYCount ) {
      average += this.minYCount * LinearEdge.evaluateLineIntegralDistance( minX, minY, maxX, minY ) / area;
    }
    if ( this.maxXCount ) {
      average += this.maxXCount * LinearEdge.evaluateLineIntegralDistance( maxX, minY, maxX, maxY ) / area;
    }
    if ( this.maxYCount ) {
      average += this.maxYCount * LinearEdge.evaluateLineIntegralDistance( minX, maxY, maxX, maxY ) / area;
    }

    return average;
  }

  /**
   * Returns the average distance from the origin to every point inside the face transformed by the given matrix.
   */
  public getAverageDistanceTransformedToOrigin( transform: Matrix3, area: number ): number {
    let average = this.clippedEdgedFace.getAverageDistanceTransformedToOrigin( transform, area );

    if ( this.minXCount || this.minYCount || this.maxXCount || this.maxYCount ) {
      const divisor = area * transform.getSignedScale();

      const minXMinY = transform.multiplyVector2( scratchVectorA.setXY( this.minX, this.minY ) );
      const minXMaxY = transform.multiplyVector2( scratchVectorB.setXY( this.minX, this.maxY ) );
      const maxXMinY = transform.multiplyVector2( scratchVectorC.setXY( this.maxX, this.minY ) );
      const maxXMaxY = transform.multiplyVector2( scratchVectorD.setXY( this.maxX, this.maxY ) );

      if ( this.minXCount ) {
        average += this.minXCount * LinearEdge.evaluateLineIntegralDistance( minXMinY.x, minXMinY.y, minXMaxY.x, minXMaxY.y ) / divisor;
      }
      if ( this.minYCount ) {
        average += this.minYCount * LinearEdge.evaluateLineIntegralDistance( minXMinY.x, minXMinY.y, maxXMinY.x, maxXMinY.y ) / divisor;
      }
      if ( this.maxXCount ) {
        average += this.maxXCount * LinearEdge.evaluateLineIntegralDistance( maxXMinY.x, maxXMinY.y, maxXMaxY.x, maxXMaxY.y ) / divisor;
      }
      if ( this.maxYCount ) {
        average += this.maxYCount * LinearEdge.evaluateLineIntegralDistance( minXMaxY.x, minXMaxY.y, maxXMaxY.x, maxXMaxY.y ) / divisor;
      }
    }

    return average;
  }

  /**
   * Returns a copy of the face that is clipped to be within the given axis-aligned bounding box.
   */
  public getClipped( minX: number, minY: number, maxX: number, maxY: number ): EdgedClippedFace {
    // TODO: consider whether containment checks are worth it. Most cases, no.
    const edges: LinearEdge[] = [];

    const centerX = ( minX + maxX ) / 2;
    const centerY = ( minY + maxY ) / 2;

    for ( let i = 0; i < this.edges.length; i++ ) {
      const edge = this.edges[ i ];
      BoundsClipping.boundsClipEdge(
        edge.startPoint, edge.endPoint,
        minX, minY, maxX, maxY, centerX, centerY,
        edges
      );
    }

    this.forEachImplicitEdge( ( startPoint, endPoint ) => {
      BoundsClipping.boundsClipEdge(
        startPoint, endPoint,
        minX, minY, maxX, maxY, centerX, centerY,
        edges
      );
    } );

    // TODO: a more optimized form here! The clipping could output counts instead of us having to check here
    return EdgedClippedFace.fromEdges( edges, minX, minY, maxX, maxY );
  }

  /**
   * Returns two copies of the face, one that is clipped to be to the left of the given x value, and one that is
   * clipped to be to the right of the given x value.
   *
   * The fakeCornerY is used to determine the "fake" corner that is used for unsorted-edge clipping.
   */
  public getBinaryXClip( x: number, fakeCornerY: number ): { minFace: EdgedClippedFace; maxFace: EdgedClippedFace } {
    return BinaryClipping.binaryXClipEdgedClipped( this, x );
  }

  /**
   * Returns two copies of the face, one that is clipped to y values less than the given y value, and one that is
   * clipped to values greater than the given y value.
   *
   * The fakeCornerX is used to determine the "fake" corner that is used for unsorted-edge clipping.
   */
  public getBinaryYClip( y: number, fakeCornerX: number ): { minFace: EdgedClippedFace; maxFace: EdgedClippedFace } {
    return BinaryClipping.binaryYClipEdgedClipped( this, y );
  }

  /**
   * Returns two copies of the face, one that is clipped to contain points where dot( normal, point ) < value,
   * and one that is clipped to contain points where dot( normal, point ) > value.
   *
   * The fake corner perpendicular is used to determine the "fake" corner that is used for unsorted-edge clipping
   */
  public getBinaryLineClip( normal: Vector2, value: number, fakeCornerPerpendicular: number ): { minFace: EdgedClippedFace; maxFace: EdgedClippedFace } {
    const minEdges: LinearEdge[] = [];
    const maxEdges: LinearEdge[] = [];

    for ( let i = 0; i < this.edges.length; i++ ) {
      const edge = this.edges[ i ];

      BinaryClipping.binaryLineClipEdge( edge.startPoint, edge.endPoint, normal, value, fakeCornerPerpendicular, minEdges, maxEdges );
    }

    this.forEachImplicitEdge( ( startPoint, endPoint ) => {
      BinaryClipping.binaryLineClipEdge( startPoint, endPoint, normal, value, fakeCornerPerpendicular, minEdges, maxEdges );
    } );

    assert && assert( minEdges.every( e => normal.dot( e.startPoint ) <= value + 1e-8 && normal.dot( e.endPoint ) <= value + 1e-8 ) );
    assert && assert( maxEdges.every( e => normal.dot( e.startPoint ) >= value - 1e-8 && normal.dot( e.endPoint ) >= value - 1e-8 ) );

    // TODO: a more optimized form here! The clipping could output counts instead of us having to check here
    // NOTE: We can't really refine the bounds here.
    return {
      minFace: EdgedClippedFace.fromEdges( minEdges, this.minX, this.minY, this.maxX, this.maxY ),
      maxFace: EdgedClippedFace.fromEdges( maxEdges, this.minX, this.minY, this.maxX, this.maxY )
    };
  }

  /**
   * Returns an array of faces, clipped similarly to getBinaryLineClip, but with more than one (parallel) split line at
   * a time. The first face will be the one with dot( normal, point ) < values[0], the second one with
   * values[ 0 ] < dot( normal, point ) < values[1], etc.
   */
  public getStripeLineClip( normal: Vector2, values: number[], fakeCornerPerpendicular: number ): EdgedClippedFace[] {
    if ( values.length === 0 ) {
      return [ this ];
    }

    const edgesCollection: LinearEdge[][] = _.range( values.length + 1 ).map( () => [] );

    for ( let i = 0; i < this.edges.length; i++ ) {
      const edge = this.edges[ i ];

      StripeClipping.binaryStripeClipEdge( edge.startPoint, edge.endPoint, normal, values, fakeCornerPerpendicular, edgesCollection );
    }

    this.forEachImplicitEdge( ( startPoint, endPoint ) => {
      StripeClipping.binaryStripeClipEdge( startPoint, endPoint, normal, values, fakeCornerPerpendicular, edgesCollection );
    } );

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

    return edgesCollection.map( edges => EdgedClippedFace.fromEdges( edges, this.minX, this.minY, this.maxX, this.maxY ) );
  }

  /**
   * Returns two copies of the face, one that is clipped to contain points inside the circle defined by the given
   * center and radius, and one that is clipped to contain points outside the circle.
   *
   * NOTE: maxAngleSplit is used to determine the polygonal approximation of the circle. The returned result will not
   * have a chord with an angle greater than maxAngleSplit.
   */
  public getBinaryCircularClip( center: Vector2, radius: number, maxAngleSplit: number ): { insideFace: EdgedClippedFace; outsideFace: EdgedClippedFace } {
    const insideEdges: LinearEdge[] = [];
    const outsideEdges: LinearEdge[] = [];

    CircularClipping.binaryCircularClipEdges( this.getAllEdges(), center, radius, maxAngleSplit, insideEdges, outsideEdges );

    return {
      insideFace: EdgedClippedFace.fromEdges( insideEdges, this.minX, this.minY, this.maxX, this.maxY ),
      outsideFace: EdgedClippedFace.fromEdges( outsideEdges, this.minX, this.minY, this.maxX, this.maxY )
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
    for ( let i = 0; i < this.edges.length; i++ ) {
      const edge = this.edges[ i ];

      GridClipping.gridClipIterate(
        edge.startPoint, edge.endPoint,
        minX, minY, maxX, maxY,
        stepX, stepY, stepWidth, stepHeight,
        callback
      );
    }

    this.forEachImplicitEdge( ( startPoint, endPoint ) => {
      GridClipping.gridClipIterate(
        startPoint, endPoint,
        minX, minY, maxX, maxY,
        stepX, stepY, stepWidth, stepHeight,
        callback
      );
    } );

    if ( this.edges.length ) {
      polygonCompleteCallback();
    }
  }

  /**
   * Returns the evaluation of the bilinear (tent) filter integrals for the given point, ASSUMING that the face
   * is clipped to the transformed unit square of x: [minX,minX+1], y: [minY,minY+1].
   */
  public getBilinearFiltered( pointX: number, pointY: number, minX: number, minY: number ): number {
    // TODO: optimization
    // TODO: we REALLY should have a ClippedFace primitive?
    return PolygonBilinear.evaluateLinearEdges( this.getAllEdges(), pointX, pointY, minX, minY );
  }

  /**
   * Returns the evaluation of the Mitchell-Netravali (1/3,1/3) filter integrals for the given point, ASSUMING that the
   * face is clipped to the transformed unit square of x: [minX,minX+1], y: [minY,minY+1].
   */
  public getMitchellNetravaliFiltered( pointX: number, pointY: number, minX: number, minY: number ): number {
    // TODO: optimization
    return PolygonMitchellNetravali.evaluateLinearEdges( this.getAllEdges(), pointX, pointY, minX, minY );
  }

  /**
   * Returns whether the face contains the given point.
   */
  public containsPoint( point: Vector2 ): boolean {
    let windingNumber = LinearEdge.getWindingNumberEdges( this.edges, point );

    this.forEachImplicitEdge( ( startPoint, endPoint ) => {
      windingNumber += LinearEdge.windingContribution(
        startPoint.x, startPoint.y, endPoint.x, endPoint.y, point.x, point.y
      );
    } );

    return windingNumber !== 0;
  }

  /**
   * Returns an affine-transformed version of the face.
   */
  public getTransformed( transform: Matrix3 ): EdgedClippedFace {
    if ( transform.isIdentity() ) {
      return this;
    }
    else {
      const transformedEdges: LinearEdge[] = [];

      const allEdges = this.getAllEdges();

      for ( let i = 0; i < allEdges.length; i++ ) {
        const edge = allEdges[ i ];

        const start = transform.timesVector2( edge.startPoint );
        const end = transform.timesVector2( edge.endPoint );

        if ( !start.equals( end ) ) {
          transformedEdges.push( new LinearEdge( start, end ) );
        }
      }

      const bounds = new Bounds2( this.minX, this.minY, this.maxX, this.maxY ).transform( transform );

      return EdgedClippedFace.fromEdgesWithoutCheck( transformedEdges, bounds.minX, bounds.minY, bounds.maxX, bounds.maxY );
    }
  }

  /**
   * Returns a rounded version of the face, where [-epsilon/2, epsilon/2] rounds to 0, etc.
   */
  public getRounded( epsilon: number ): EdgedClippedFace {
    const edges = [];

    for ( let i = 0; i < this.edges.length; i++ ) {
      const edge = this.edges[ i ];

      const startPoint = new Vector2(
        roundSymmetric( edge.startPoint.x / epsilon ) * epsilon,
        roundSymmetric( edge.startPoint.y / epsilon ) * epsilon
      );

      const endPoint = new Vector2(
        roundSymmetric( edge.endPoint.x / epsilon ) * epsilon,
        roundSymmetric( edge.endPoint.y / epsilon ) * epsilon
      );

      if ( !startPoint.equals( endPoint ) ) {
        edges.push( new LinearEdge( startPoint, endPoint, edge.containsFakeCorner ) );
      }
    }

    // TODO: more code sharing?
    this.forEachImplicitEdge( ( startPoint, endPoint ) => {
      const roundedStartPoint = new Vector2(
        roundSymmetric( startPoint.x / epsilon ) * epsilon,
        roundSymmetric( startPoint.y / epsilon ) * epsilon
      );

      const roundedEndPoint = new Vector2(
        roundSymmetric( endPoint.x / epsilon ) * epsilon,
        roundSymmetric( endPoint.y / epsilon ) * epsilon
      );

      if ( !roundedStartPoint.equals( roundedEndPoint ) ) {
        edges.push( new LinearEdge( roundedStartPoint, roundedEndPoint ) );
      }
    } );

    return EdgedClippedFace.fromEdgesWithoutCheck(
      edges,
      roundSymmetric( this.minX / epsilon ) * epsilon,
      roundSymmetric( this.minY / epsilon ) * epsilon,
      roundSymmetric( this.maxX / epsilon ) * epsilon,
      roundSymmetric( this.maxY / epsilon ) * epsilon
    );
  }

  /**
   * Returns a version of the face with the orientation of all of the edges swapped.
   */
  public withReversedEdges(): EdgedClippedFace {
    return new EdgedClippedFace(
      this.edges.map( edge => new LinearEdge( edge.endPoint, edge.startPoint ) ).reverse(),
      this.minX, this.minY, this.maxX, this.maxY,
      -this.maxXCount, -this.maxYCount, -this.minXCount, -this.minYCount
    );
  }

  /**
   * Calls the callback with points for each edge in the face.
   */
  public forEachEdge( callback: ( startPoint: Vector2, endPoint: Vector2 ) => void ): void {
    for ( let i = 0; i < this.edges.length; i++ ) {
      const edge = this.edges[ i ];
      callback( edge.startPoint, edge.endPoint );
    }

    this.forEachImplicitEdge( callback );
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
  public getScratchAccumulator(): ClippableFaceAccumulator<EdgedClippedFace> {
    return edgedClippedScratchAccumulator;
  }

  /**
   * Returns a singleton accumulator for this type of face. This will always return the same instance, and should ONLY
   * be used if there will be no reentrant or co-occurring usage of this accumulator (i.e. only use it when you can
   * guarantee nothing else will be clipped at the same time). If two tasks try to use this at the same time, it will
   * likely break.
   *
   * This should be used directly when you know you want an EdgedClippedFace as output.
   */
  public static getScratchAccumulator(): ClippableFaceAccumulator<EdgedClippedFace> {
    return edgedClippedScratchAccumulator;
  }

  /**
   * Returns a new accumulator for this type of face. This should be used when concurrent clipping will need to happen.
   *
   * This is a method that can be called on an unknown-type face, to reproduce the same type of face. This is
   * important, since we can't feed unsorted edge data directly to a PolygonalFace's accumulator, and in general this
   * is the safest way to get an accumulator for a face.
   */
  public getAccumulator(): ClippableFaceAccumulator<EdgedClippedFace> {
    return new EdgedClippedFaceAccumulator();
  }

  /**
   * Returns a debugging string.
   */
  public toString(): string {
    return this.getAllEdges().map( e => `${e.startPoint.x},${e.startPoint.y} => ${e.endPoint.x},${e.endPoint.y}` ).join( '\n' );
  }

  /**
   * Returns a serialized version of the face, that should be able to be deserialized into the same type of face.
   * See {FaceType}.deserialize.
   *
   * NOTE: If you don't know what type of face this is, use serializeClippableFace instead.
   */
  public serialize(): SerializedEdgedClippedFace {
    return {
      edges: this.edges.map( edge => edge.serialize() ),
      minX: this.minX,
      minY: this.minY,
      maxX: this.maxX,
      maxY: this.maxY,
      minXCount: this.minXCount,
      minYCount: this.minYCount,
      maxXCount: this.maxXCount,
      maxYCount: this.maxYCount
    };
  }

  public static deserialize( serialized: SerializedEdgedClippedFace ): EdgedClippedFace {
    return new EdgedClippedFace(
      serialized.edges.map( edge => LinearEdge.deserialize( edge ) ),
      serialized.minX,
      serialized.minY,
      serialized.maxX,
      serialized.maxY,
      serialized.minXCount,
      serialized.minYCount,
      serialized.maxXCount,
      serialized.maxYCount
    );
  }

  public static fromBounds( bounds: Bounds2 ): EdgedClippedFace {
    return new EdgedClippedFace(
      [],
      bounds.minX,
      bounds.minY,
      bounds.maxX,
      bounds.maxY,
      -1, 1, 1, -1
    );
  }

  public static fromBoundsValues( minX: number, minY: number, maxX: number, maxY: number ): EdgedClippedFace {
    return new EdgedClippedFace(
      [],
      minX, minY, maxX, maxY,
      -1, 1, 1, -1
    );
  }
}

alpenglow.register( 'EdgedClippedFace', EdgedClippedFace );

export class EdgedClippedFaceAccumulator implements ClippableFaceAccumulator<EdgedClippedFace> {

  private edges: LinearEdge[] = [];
  private minX = 0;
  private minY = 0;
  private maxX = 0;
  private maxY = 0;
  private minXCount = 0;
  private minYCount = 0;
  private maxXCount = 0;
  private maxYCount = 0;

  public readonly usesEndPoint = true;

  public addEdge( startX: number, startY: number, endX: number, endY: number, startPoint: Vector2 | null, endPoint: Vector2 | null ): void {
    if ( assertSlow ) {
      const start = startPoint || new Vector2( startX, startY );
      const end = endPoint || new Vector2( endX, endY );

      assertSlow( start.x >= this.minX - 1e-8 && start.x <= this.maxX + 1e-8 &&
              start.y >= this.minY - 1e-8 && start.y <= this.maxY + 1e-8 &&
              end.x >= this.minX - 1e-8 && end.x <= this.maxX + 1e-8 &&
              end.y >= this.minY - 1e-8 && end.y <= this.maxY + 1e-8
      );
    }

    if (
      // If all points are on a corner
      ( startX === this.minX || startX === this.maxX ) &&
       ( startY === this.minY || startY === this.maxY ) &&
       ( endX === this.minX || endX === this.maxX ) &&
       ( endY === this.minY || endY === this.maxY ) &&
      // And we're not on opposite corners
       ( startX === endX || startY === endY )
    ) {
      assert && assert( startX !== endX || startY !== endY, 'Points should not be identical' );

      if ( startX === endX ) {
        const delta = ( startY === this.minY ? 1 : -1 );
        if ( startX === this.minX ) {
          this.minXCount += delta;
        }
        else {
          this.maxXCount += delta;
        }
      }
      else {
        const delta = ( startX === this.minX ? 1 : -1 );
        if ( startY === this.minY ) {
          this.minYCount += delta;
        }
        else {
          this.maxYCount += delta;
        }
      }
    }
    else {
      this.edges.push( new LinearEdge(
        startPoint || new Vector2( startX, startY ),
        endPoint || new Vector2( endX, endY )
      ) );
    }
  }

  public markNewPolygon(): void {
    // no-op, since we're storing unsorted edges!
  }

  public setAccumulationBounds( minX: number, minY: number, maxX: number, maxY: number ): void {
    this.minX = minX;
    this.minY = minY;
    this.maxX = maxX;
    this.maxY = maxY;
    this.minXCount = 0;
    this.minYCount = 0;
    this.maxXCount = 0;
    this.maxYCount = 0;
  }

  // Will reset it to the initial state also
  public finalizeFace(): EdgedClippedFace | null {
    if ( this.edges.length === 0 && this.minXCount === 0 && this.minYCount === 0 && this.maxXCount === 0 && this.maxYCount === 0 ) {
      return null;
    }

    const result = new EdgedClippedFace( this.edges, this.minX, this.minY, this.maxX, this.maxY, this.minXCount, this.minYCount, this.maxXCount, this.maxYCount );

    this.edges = [];
    this.minXCount = 0;
    this.minYCount = 0;
    this.maxXCount = 0;
    this.maxYCount = 0;

    return result;
  }

  public finalizeEnsureFace( minX: number, minY: number, maxX: number, maxY: number ): EdgedClippedFace {
    return this.finalizeFace() || new EdgedClippedFace( emptyArray, minX, minY, maxX, maxY, 0, 0, 0, 0 );
  }

  // Will reset without creating a face
  public reset(): void {
    this.edges.length = 0;
    this.minXCount = 0;
    this.minYCount = 0;
    this.maxXCount = 0;
    this.maxYCount = 0;
  }
}

const edgedClippedScratchAccumulator = new EdgedClippedFaceAccumulator();

export type SerializedEdgedClippedFace = {
  edges: SerializedLinearEdge[];
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  minXCount: number;
  minYCount: number;
  maxXCount: number;
  maxYCount: number;
};

/**
 * A ClippableFace from a set of polygons (each one is a closed loop of Vector2s)
 *
 * Relies on the main boundary being positive-oriented, and the holes being negative-oriented and non-overlapping
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */
export class PolygonalFace implements ClippableFace {
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
        roundSymmetric( vertex.x / epsilon ) * epsilon,
        roundSymmetric( vertex.y / epsilon ) * epsilon
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
    return polygonalFaceScratchAccumulator;
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
    return polygonalFaceScratchAccumulator;
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

const polygonalFaceScratchAccumulator = new PolygonalFaceAccumulator();

export type SerializedPolygonalFace = {
  polygons: { x: number; y: number }[][];
};


const simplifier = new ClipSimplifier();

/**
 * Clipping arbitrary (degenerate, non-convex, self-intersecting, etc.) polygons to the inside/outside of a circle.
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */
export class CircularClipping {

  /**
   * Clips a polygon (represented by unsorted LinearEdges) by a circle. This will output both the inside and outside,
   * appending LinearEdges to the given arrays.
   *
   * @param edges - the edges of the polygon to clip
   * @param center - the center of the circle
   * @param radius - the radius of the circle
   * @param maxAngleSplit - the maximum angle of a circular arc that will be converted into a linear edge
   * @param inside - (OUTPUT) the edges that are inside the circle (will be appended to)
   * @param outside - (OUTPUT) the edges that are outside the circle (will be appended to)
   */
  public static binaryCircularClipEdges(
    edges: LinearEdge[],
    center: Vector2,
    radius: number,
    maxAngleSplit: number,
    inside: LinearEdge[],
    outside: LinearEdge[]
  ): void {

    // If we inscribed a circle inside a regular polygon split at angle `maxAngleSplit`, we'd have this radius.
    // Because we're turning our circular arcs into line segments at the end, we need to make sure that content inside
    // the circle doesn't go OUTSIDE the "inner" polygon (in that sliver between the circle and regular polygon).
    // We'll do that by adding "critical angles" for any points between the radius and inradus, so that our polygonal
    // approximation of the circle has a split there.
    // inradius = r cos( pi / n ) for n segments
    // n = 2pi / maxAngleSplit
    const inradius = radius * Math.cos( 0.5 * maxAngleSplit );

    // Our general plan will be to clip by keeping things "inside" the circle, and using the duality of clipping with
    // edges to also get the "outside" edges.
    // The duality follows from the fact that if we have a "full" polygon represented by edges, and then we have a
    // "subset" of it also represented by edges, then the "full - subset" difference can be represented by including
    // both all the edges of the "full" polygon PLUS all of the edges of the "subset" polygon with their direction
    // reversed.
    // Additionally in general, instead of "appending" both of those lists, we can do MUCH better! Instead whenever
    // we INCLUDE part of an original edge in the "subset", we DO NOT include it in the other disjoint polygon, and
    // vice versa. Additionally, when we add in "new" edges (or fake ones), we need to add the REVERSE to the
    // disjoint polygon.
    // Thus we essentially get "dual" binary polygons for free.

    // Because we are clipping to "keep the inside", any edges outside we can actually just "project" down to the circle
    // (imagine wrapping the exterior edge around the circle). For the duality, we can output the internal/external
    // "parts" directly to the inside/outside result arrays, but these wrapped circular projections will need to be
    // stored for later here.
    // Each "edge" in our input will have between 0 and 1 "internal" edges, and 0 and 2 "external" edges.
    //
    // NOTE: We also need to store the start/end points, so that we output exact start/end points (instead of numerically
    // slightly-different points based on the radius/angles), for our later clipping stages to work nicely.
    const insideCircularEdges: CircularEdgeWithPoints[] = [];

    // We'll also need to store "critical" angles for the future polygonalization of the circles. If we were outputting
    // true circular edges, we could just include `insideCircularEdges`, however we want to convert it to line segments
    // so that future stages don't have to deal with this.
    // We'll need the angles so that those points on the circle will be exact (for ALL of the circular edges).
    // This is because we may be wrapping back-and-forth across the circle multiple times, with different start/end
    // angles, and we need the polygonal parts of these overlaps to be identical (to avoid precision issues later,
    // and ESPECIALLY to avoid little polygonal bits with "negative" area where the winding orientation is flipped.
    // There are two types of points where we'll need to store the angles:
    // 1. Intersections with our circle (where we'll need to "split" the edge into two at that point)
    // 2. Points where we are between the circumradius and inradius of the roughest "regular" polygon we might generate.

    // between [-pi,pi], from atan2, tracked so we can turn the arcs piecewise-linear in a consistent fashion later
    let angles: number[] = [];

    // Process a fully-inside-the-circle part of an edge
    const processInternal = ( edge: LinearEdge ) => {
      inside.push( edge );

      const localStart = edge.startPoint.minus( center );
      const localEnd = edge.endPoint.minus( center );

      // We're already inside the circle, so the circumradius check isn't needed. If we're inside the inradius,
      // ensure the critical angles are added.
      if ( localStart.magnitude > inradius ) {
        angles.push( localStart.angle );
      }
      if ( localEnd.magnitude > inradius ) {
        angles.push( localEnd.angle );
      }
    };

    // Process a fully-outside-the-circle part of an edge
    const processExternal = ( edge: LinearEdge, startInside: boolean, endInside: boolean ) => {
      outside.push( edge );

      const localStart = edge.startPoint.minus( center );
      const localEnd = edge.endPoint.minus( center );

      // Modify (project) them into points of the given radius.
      localStart.multiplyScalar( radius / localStart.magnitude );
      localEnd.multiplyScalar( radius / localEnd.magnitude );

      // Handle projecting the edge to the circle.
      // We'll only need to do extra work if the projected points are not equal. If we had a line that was pointed
      // toward the center of the circle, it would project down to a single point, and we wouldn't have any contribution.
      if ( !localStart.equalsEpsilon( localEnd, 1e-8 ) ) {
        // Check to see which way we went "around" the circle

        // (y, -x) perpendicular, so a clockwise pi/2 rotation
        const isClockwise = localStart.perpendicular.dot( localEnd ) > 0;

        const startAngle = localStart.angle;
        const endAngle = localEnd.angle;

        angles.push( startAngle );
        angles.push( endAngle );

        insideCircularEdges.push( new CircularEdgeWithPoints(
          startInside ? edge.startPoint : null,
          endInside ? edge.endPoint : null,
          startAngle,
          endAngle,
          !isClockwise
        ) );
      }
      else {
        // NOTE: We need to do our "fixing" of coordinate matching in this case. It's possible we may need to add
        // a very small "infinitesimal" edge.
        let projectedStart = Vector2.createPolar( radius, localStart.angle ).add( center );
        let projectedEnd = Vector2.createPolar( radius, localEnd.angle ).add( center );

        if ( startInside ) {
          assert && assert( projectedStart.distanceSquared( edge.startPoint ) < 1e-8 );
          projectedStart = edge.startPoint;
        }
        if ( endInside ) {
          assert && assert( projectedEnd.distanceSquared( edge.endPoint ) < 1e-8 );
          projectedEnd = edge.endPoint;
        }

        if ( !projectedStart.equals( projectedEnd ) ) {
          inside.push( new LinearEdge( projectedStart, projectedEnd ) );
          outside.push( new LinearEdge( projectedEnd, projectedStart ) );
        }
      }
    };

    for ( let i = 0; i < edges.length; i++ ) {
      const edge = edges[ i ];

      const startInside = edge.startPoint.distance( center ) <= radius;
      const endInside = edge.endPoint.distance( center ) <= radius;

      // If the endpoints are within the circle, the entire contents will be also (shortcut)
      if ( startInside && endInside ) {
        processInternal( edge );
        continue;
      }

      // Now, we'll solve for the t-values of the intersection of the line and the circle.
      // e.g. p0 + t * ( p1 - p0 ) will be on the circle. This is solvable with a quadratic equation.
      const p0x = edge.startPoint.x - center.x;
      const p0y = edge.startPoint.y - center.y;
      const p1x = edge.endPoint.x - center.x;
      const p1y = edge.endPoint.y - center.y;
      const dx = p1x - p0x;
      const dy = p1y - p0y;

      // quadratic to solve
      const a = dx * dx + dy * dy;
      const b = 2 * ( p0x * dx + p0y * dy );
      const c = p0x * p0x + p0y * p0y - radius * radius;

      assert && assert( a > 0, 'We should have a delta, assumed in code below' );

      const roots = solveQuadraticRootsReal( a, b, c );

      let isFullyExternal = false;

      // If we have no roots, we're fully outside the circle!
      if ( !roots || roots.length === 0 ) {
        isFullyExternal = true;
      }
      else {
        if ( roots.length === 1 ) {
          roots.push( roots[ 0 ] );
        }
        assert && assert( roots[ 0 ] <= roots[ 1 ], 'Easier for us to assume root ordering' );
        const rootA = roots[ 0 ];
        const rootB = roots[ 1 ];

        if ( rootB <= 0 || rootA >= 1 ) {
          isFullyExternal = true;
        }

        // If our roots are identical, we are TANGENT to the circle. We can consider this to be fully external, since
        // there will not be an internal section.
        if ( rootA === rootB ) {
          isFullyExternal = true;
        }
      }

      if ( isFullyExternal ) {
        processExternal( edge, startInside, endInside );
        continue;
      }

      assert && assert( roots![ 0 ] <= roots![ 1 ], 'Easier for us to assume root ordering' );
      const rootA = roots![ 0 ];
      const rootB = roots![ 1 ];

      // Compute intersection points (when the t values are in the range [0,1])
      const rootAInSegment = rootA > 0 && rootA < 1;
      const rootBInSegment = rootB > 0 && rootB < 1;
      const deltaPoints = edge.endPoint.minus( edge.startPoint );
      const rootAPoint = rootAInSegment ? ( edge.startPoint.plus( deltaPoints.timesScalar( rootA ) ) ) : Vector2.ZERO; // ignore the zero, it's mainly for typing
      const rootBPoint = rootBInSegment ? ( edge.startPoint.plus( deltaPoints.timesScalar( rootB ) ) ) : Vector2.ZERO; // ignore the zero, it's mainly for typing

      if ( rootAInSegment && rootBInSegment ) {
        processExternal( new LinearEdge( edge.startPoint, rootAPoint ), startInside, true );
        processInternal( new LinearEdge( rootAPoint, rootBPoint ) );
        processExternal( new LinearEdge( rootBPoint, edge.endPoint ), true, endInside );
      }
      else if ( rootAInSegment ) {
        processExternal( new LinearEdge( edge.startPoint, rootAPoint ), startInside, true );
        processInternal( new LinearEdge( rootAPoint, edge.endPoint ) );
      }
      else if ( rootBInSegment ) {
        processInternal( new LinearEdge( edge.startPoint, rootBPoint ) );
        processExternal( new LinearEdge( rootBPoint, edge.endPoint ), true, endInside );
      }
      else {
        assert && assert( false, 'Should not reach this point, due to the boolean constraints above' );
      }
    }

    // Sort our critical angles, so we can iterate through unique values in-order
    angles = _.uniq( angles.sort( ( a, b ) => a - b ) );

    for ( let i = 0; i < insideCircularEdges.length; i++ ) {
      const edge = insideCircularEdges[ i ];

      const startIndex = angles.indexOf( edge.startAngle );
      const endIndex = angles.indexOf( edge.endAngle );

      const subAngles: number[] = [];

      // Iterate (in the specific direction) through the angles we cover, and add them to our subAngles list.
      const dirSign = edge.counterClockwise ? 1 : -1;
      for ( let index = startIndex; index !== endIndex; index = ( index + dirSign + angles.length ) % angles.length ) {
        subAngles.push( angles[ index ] );
      }
      subAngles.push( angles[ endIndex ] );

      for ( let j = 0; j < subAngles.length - 1; j++ ) {
        const startAngle = subAngles[ j ];
        const endAngle = subAngles[ j + 1 ];

        // Put our end angle in the dirSign direction from our startAngle (if we're counterclockwise and our angle increases,
        // our relativeEndAngle should be greater than our startAngle, and similarly if we're clockwise and our angle decreases,
        // our relativeEndAngle should be less than our startAngle)
        const relativeEndAngle = ( edge.counterClockwise === ( startAngle < endAngle ) ) ? endAngle : endAngle + dirSign * Math.PI * 2;

        // Split our circular arc into segments!
        const angleDiff = relativeEndAngle - startAngle;
        const numSegments = Math.ceil( Math.abs( angleDiff ) / maxAngleSplit );
        for ( let k = 0; k < numSegments; k++ ) {
          const startTheta = startAngle + angleDiff * ( k / numSegments );
          const endTheta = startAngle + angleDiff * ( ( k + 1 ) / numSegments );

          let startPoint = Vector2.createPolar( radius, startTheta ).add( center );
          let endPoint = Vector2.createPolar( radius, endTheta ).add( center );

          if ( edge.startPoint && j === 0 && k === 0 ) {
            // First "point" of a insideCircularEdge, let's replace with our actual start point for exact precision
            assert && assert( startPoint.distanceSquared( edge.startPoint ) < 1e-8 );
            startPoint = edge.startPoint;
          }
          if ( edge.endPoint && j === subAngles.length - 2 && k === numSegments - 1 ) {
            // Last "point" of an insideCircularEdge, let's replace with our actual end point for exact precision
            assert && assert( endPoint.distanceSquared( edge.endPoint ) < 1e-8 );
            endPoint = edge.endPoint;
          }

          // We might have tiny angle/etc. distances, so we could come into edges that we need to strip
          if ( !startPoint.equals( endPoint ) ) {
            inside.push( new LinearEdge( startPoint, endPoint ) );
            outside.push( new LinearEdge( endPoint, startPoint ) );
          }
        }
      }
    }
  }

  /**
   * Clips a polygon (represented by polygonal vertex lists) by a circle. This will output both the inside and outside,
   * appending vertices to the arrays
   *
   * @param polygons
   * @param center - the center of the circle
   * @param radius - the radius of the circle
   * @param maxAngleSplit - the maximum angle of a circular arc that will be converted into a linear edge
   * @param inside - (OUTPUT) the polygon that is inside the circle (will be appended to)
   * @param outside - (OUTPUT) the polygon that is outside the circle (will be appended to)
   */
  public static binaryCircularClipPolygon(
    polygons: Vector2[][],
    center: Vector2,
    radius: number,
    maxAngleSplit: number,
    inside: Vector2[][],
    outside: Vector2[][]
  ): void {

    const radiusSquared = radius * radius;

    // If we inscribed a circle inside a regular polygon split at angle `maxAngleSplit`, we'd have this radius.
    // Because we're turning our circular arcs into line segments at the end, we need to make sure that content inside
    // the circle doesn't go OUTSIDE the "inner" polygon (in that sliver between the circle and regular polygon).
    // We'll do that by adding "critical angles" for any points between the radius and inradus, so that our polygonal
    // approximation of the circle has a split there.
    // inradius = r cos( pi / n ) for n segments
    // n = 2pi / maxAngleSplit
    const inradius = radius * Math.cos( 0.5 * maxAngleSplit );

    // Our general plan will be to clip by keeping things "inside" the circle, and using the duality of clipping with
    // edges to also get the "outside" edges.
    // The duality follows from the fact that if we have a "full" polygon represented by edges, and then we have a
    // "subset" of it also represented by edges, then the "full - subset" difference can be represented by including
    // both all the edges of the "full" polygon PLUS all of the edges of the "subset" polygon with their direction
    // reversed.
    // Additionally in general, instead of "appending" both of those lists, we can do MUCH better! Instead whenever
    // we INCLUDE part of an original edge in the "subset", we DO NOT include it in the other disjoint polygon, and
    // vice versa. Additionally, when we add in "new" edges (or fake ones), we need to add the REVERSE to the
    // disjoint polygon.
    // Thus we essentially get "dual" binary polygons for free.

    // Because we are clipping to "keep the inside", any edges outside we can actually just "project" down to the circle
    // (imagine wrapping the exterior edge around the circle). For the duality, we can output the internal/external
    // "parts" directly to the inside/outside result arrays, but these wrapped circular projections will need to be
    // stored for later here.
    // Each "edge" in our input will have between 0 and 1 "internal" edges, and 0 and 2 "external" edges.

    // Because we're handling the polygonal form, we'll need to do some complicated handling for the outside. Whenever
    // we have a transition to the outside (at a specific point), we'll start recording the "outside" edges in one
    // "forward" list, and the corresponding circular movements in the "reverse" list (it will be in the wrong order,
    // and will be reversed later). Once our polygon goes back inside, we'll be able to stitch these together to create
    // an "outside" polygon (forward edges + reversed reverse edges).

    // This gets TRICKIER because if we start outside, we'll have an "unclosed" section of a polygon. We'll need to
    // store THOSE edges in the "outsideStartOutside" list, so that once we finish the polygon, we can rejoin them with
    // the other unprocessed "outside" edges.

    // We'll need to detect crossings of the circle, so that we can "join" the outside edges together. This is somewhat
    // complicated by the fact that the endpoints of a segment may be on the circle, so one edge might be fully
    // internal, and the next might be fully external. We'll use an epsilon to detect this.

    // -------------

    // Our edges of output polygons (that will need to be "split up" if they are circular) will be stored here. These
    // are in "final" form, except for the splitting.
    const insideCandidatePolygons: ( LinearEdge | CircularEdge )[][] = [];
    const outsideCandidatePolygons: ( LinearEdge | CircularEdge )[][] = [];

    // Our "inside" edges are always stored in the "forward" order. For every input polygon, we'll push here and then
    // put this into the insideCandidatePolygons array (one input polygon to one potential output polygon).
    const insideCandidateEdges: ( LinearEdge | CircularEdge )[] = [];

    // The arrays we push outside edges when hasOutsideStartPoint = false. When we have a crossing, we'll have a
    // complete outside polygon to push to outsideCandidatePolygons.
    const outsideCandidateForwardEdges: LinearEdge[] = [];
    const outsideCandidateReversedEdges: CircularEdge[] = [];

    // We'll need to handle the cases where we start "outside", and thus don't have the matching "outside" edges yet.
    // If we have an outside start point, we'll need to store the edges until we are completely done with that input
    // polygon, then will connect them up!
    let hasOutsideStartPoint = false;
    let hasInsidePoint = false;
    const outsideStartOutsideCandidateForwardEdges: LinearEdge[] = [];
    const outsideStartOutsideCandidateReversedEdges: CircularEdge[] = [];

    // We'll also need to store "critical" angles for the future polygonalization of the circles. If we were outputting
    // true circular edges, we could just include `insideCircularEdges`, however we want to convert it to line segments
    // so that future stages don't have to deal with this.
    // We'll need the angles so that those points on the circle will be exact (for ALL of the circular edges).
    // This is because we may be wrapping back-and-forth across the circle multiple times, with different start/end
    // angles, and we need the polygonal parts of these overlaps to be identical (to avoid precision issues later,
    // and ESPECIALLY to avoid little polygonal bits with "negative" area where the winding orientation is flipped.
    // There are two types of points where we'll need to store the angles:
    // 1. Intersections with our circle (where we'll need to "split" the edge into two at that point)
    // 2. Points where we are between the circumradius and inradius of the roughest "regular" polygon we might generate.

    // Because we need to output polygon data in order, we'll need to process ALL of the data, determine the angles,
    // and then output all of it.

    // between [-pi,pi], from atan2, tracked so we can turn the arcs piecewise-linear in a consistent fashion later
    let angles: number[] = [];

    const processCrossing = () => {
      // We crossed! Now our future "outside" handling will have a "joined" start point
      hasOutsideStartPoint = false;

      if ( outsideCandidateForwardEdges.length ) {
        outsideCandidateReversedEdges.reverse();

        // Ensure that our start and end points match up
        if ( assert ) {
          const startEdgePoint = outsideCandidateForwardEdges[ 0 ].startPoint;
          const endEdgePoint = outsideCandidateForwardEdges[ outsideCandidateForwardEdges.length - 1 ].endPoint;
          const startRadialPoint = Vector2.createPolar( radius, outsideCandidateReversedEdges[ 0 ].startAngle ).add( center );
          const endRadialPoint = Vector2.createPolar( radius, outsideCandidateReversedEdges[ outsideCandidateReversedEdges.length - 1 ].endAngle ).add( center );

          assert( startEdgePoint.equalsEpsilon( endRadialPoint, 1e-6 ) );
          assert( endEdgePoint.equalsEpsilon( startRadialPoint, 1e-6 ) );
        }

        const candidatePolygon = [
          ...outsideCandidateForwardEdges,
          ...outsideCandidateReversedEdges
        ];
        outsideCandidatePolygons.push( candidatePolygon );

        outsideCandidateForwardEdges.length = 0;
        outsideCandidateReversedEdges.length = 0;
      }
    };

    // Process a fully-inside-the-circle part of an edge
    const processInternal = ( start: Vector2, end: Vector2 ) => {
      insideCandidateEdges.push( new LinearEdge( start, end ) );

      const localStart = start.minus( center );
      const localEnd = end.minus( center );

      // We're already inside the circle, so the circumradius check isn't needed. If we're inside the inradius,
      // ensure the critical angles are added.
      if ( localStart.magnitude > inradius ) {
        angles.push( localStart.angle );
      }
      if ( localEnd.magnitude > inradius ) {
        angles.push( localEnd.angle );
      }
    };

    // Process a fully-outside-the-circle part of an edge
    const processExternal = ( start: Vector2, end: Vector2 ) => {

      if ( hasOutsideStartPoint ) {
        outsideStartOutsideCandidateForwardEdges.push( new LinearEdge( start, end ) );
      }
      else {
        outsideCandidateForwardEdges.push( new LinearEdge( start, end ) );
      }

      const localStart = start.minus( center );
      const localEnd = end.minus( center );

      // Modify (project) them into points of the given radius.
      localStart.multiplyScalar( radius / localStart.magnitude );
      localEnd.multiplyScalar( radius / localEnd.magnitude );

      // Handle projecting the edge to the circle.
      // We'll only need to do extra work if the projected points are not equal. If we had a line that was pointed
      // toward the center of the circle, it would project down to a single point, and we wouldn't have any contribution.
      if ( !localStart.equalsEpsilon( localEnd, 1e-8 ) ) {
        // Check to see which way we went "around" the circle

        // (y, -x) perpendicular, so a clockwise pi/2 rotation
        const isClockwise = localStart.perpendicular.dot( localEnd ) > 0;

        const startAngle = localStart.angle;
        const endAngle = localEnd.angle;

        angles.push( startAngle );
        angles.push( endAngle );

        insideCandidateEdges.push( new CircularEdge( startAngle, endAngle, !isClockwise ) );
        if ( hasOutsideStartPoint ) {
          // TODO: fish out this circular edge, we're using it for both
          outsideStartOutsideCandidateReversedEdges.push( new CircularEdge( endAngle, startAngle, isClockwise ) );
        }
        else {
          outsideCandidateReversedEdges.push( new CircularEdge( endAngle, startAngle, isClockwise ) );
        }
      }
    };

    // Stage to process the edges into the insideCandidatesPolygons/outsideCandidatesPolygons arrays.
    for ( let i = 0; i < polygons.length; i++ ) {
      const polygon = polygons[ i ];

      for ( let j = 0; j < polygon.length; j++ ) {
        const start = polygon[ j ];
        const end = polygon[ ( j + 1 ) % polygon.length ];

        const p0x = start.x - center.x;
        const p0y = start.y - center.y;
        const p1x = end.x - center.x;
        const p1y = end.y - center.y;

        // We'll use squared comparisons to avoid square roots
        const startDistanceSquared = p0x * p0x + p0y * p0y;
        const endDistanceSquared = p1x * p1x + p1y * p1y;

        const startInside = startDistanceSquared <= radiusSquared;
        const endInside = endDistanceSquared <= radiusSquared;

        // If we meet these thresholds, we'll process a crossing
        const startOnCircle = Math.abs( startDistanceSquared - radiusSquared ) < 1e-8;
        const endOnCircle = Math.abs( endDistanceSquared - radiusSquared ) < 1e-8;

        // If we're the first edge, set up our starting conditions
        if ( j === 0 ) {
          hasOutsideStartPoint = !startInside && !startOnCircle;
          hasInsidePoint = startInside || endInside;
        }
        else {
          hasInsidePoint = hasInsidePoint || startInside || endInside;
        }

        // If the endpoints are within the circle, the entire contents will be also (shortcut)
        if ( startInside && endInside ) {
          processInternal( start, end );
          if ( startOnCircle || endOnCircle ) {
            processCrossing();
          }
          continue;
        }

        // Now, we'll solve for the t-values of the intersection of the line and the circle.
        // e.g. p0 + t * ( p1 - p0 ) will be on the circle. This is solvable with a quadratic equation.

        const dx = p1x - p0x;
        const dy = p1y - p0y;

        // quadratic to solve
        const a = dx * dx + dy * dy;
        const b = 2 * ( p0x * dx + p0y * dy );
        const c = p0x * p0x + p0y * p0y - radius * radius;

        assert && assert( a > 0, 'We should have a delta, assumed in code below' );

        const roots = solveQuadraticRootsReal( a, b, c );

        let isFullyExternal = false;

        // If we have no roots, we're fully outside the circle!
        if ( !roots || roots.length === 0 ) {
          isFullyExternal = true;
        }
        else {
          if ( roots.length === 1 ) {
            roots.push( roots[ 0 ] );
          }
          assert && assert( roots[ 0 ] <= roots[ 1 ], 'Easier for us to assume root ordering' );
          const rootA = roots[ 0 ];
          const rootB = roots[ 1 ];

          if ( rootB <= 0 || rootA >= 1 ) {
            isFullyExternal = true;
          }

          // If our roots are identical, we are TANGENT to the circle. We can consider this to be fully external, since
          // there will not be an internal section.
          if ( rootA === rootB ) {
            isFullyExternal = true;
          }
        }

        if ( isFullyExternal ) {
          processExternal( start, end );
          continue;
        }

        assert && assert( roots![ 0 ] <= roots![ 1 ], 'Easier for us to assume root ordering' );
        const rootA = roots![ 0 ];
        const rootB = roots![ 1 ];

        // Compute intersection points (when the t values are in the range [0,1])
        const rootAInSegment = rootA > 0 && rootA < 1;
        const rootBInSegment = rootB > 0 && rootB < 1;
        const deltaPoints = end.minus( start );
        const rootAPoint = rootAInSegment ? ( start.plus( deltaPoints.timesScalar( rootA ) ) ) : Vector2.ZERO; // ignore the zero, it's mainly for typing
        const rootBPoint = rootBInSegment ? ( start.plus( deltaPoints.timesScalar( rootB ) ) ) : Vector2.ZERO; // ignore the zero, it's mainly for typing

        if ( rootAInSegment && rootBInSegment ) {
          processExternal( start, rootAPoint );
          processCrossing();
          processInternal( rootAPoint, rootBPoint );
          processCrossing();
          processExternal( rootBPoint, end );
        }
        else if ( rootAInSegment ) {
          processExternal( start, rootAPoint );
          processCrossing();
          processInternal( rootAPoint, end );
          if ( endOnCircle ) {
            processCrossing();
          }
        }
        else if ( rootBInSegment ) {
          if ( startOnCircle ) {
            processCrossing();
          }
          processInternal( start, rootBPoint );
          processCrossing();
          processExternal( rootBPoint, end );
        }
        else {
          assert && assert( false, 'Should not reach this point, due to the boolean constraints above' );
        }
      }

      // We finished the input polygon! Now we need to connect up things if we started outside.
      if ( outsideCandidateForwardEdges.length || outsideStartOutsideCandidateForwardEdges.length ) {
        // We... really should have both? Let's be permissive with epsilon checks?

        outsideCandidateReversedEdges.reverse();
        outsideStartOutsideCandidateReversedEdges.reverse();

        if ( hasInsidePoint ) {
          const candidatePolygon = [
            ...outsideCandidateForwardEdges,
            ...outsideStartOutsideCandidateForwardEdges,
            ...outsideStartOutsideCandidateReversedEdges,
            ...outsideCandidateReversedEdges
          ];
          outsideCandidatePolygons.push( candidatePolygon );

          // Ensure that all of our points must match up
          if ( assertSlow ) {
            for ( let i = 0; i < candidatePolygon.length; i++ ) {
              const edge = candidatePolygon[ i ];
              const nextEdge = candidatePolygon[ ( i + 1 ) % candidatePolygon.length ];

              const endPoint = edge instanceof LinearEdge ? edge.endPoint : Vector2.createPolar( radius, edge.endAngle ).add( center );
              const startPoint = nextEdge instanceof LinearEdge ? nextEdge.startPoint : Vector2.createPolar( radius, nextEdge.startAngle ).add( center );

              assertSlow( endPoint.equalsEpsilon( startPoint, 1e-6 ) );
            }
          }
        }
        else {
          // If we're fully external, we'll need to create two paths
          outsideCandidatePolygons.push( [
            ...outsideStartOutsideCandidateForwardEdges
          ] );
          outsideCandidatePolygons.push( [
            ...outsideStartOutsideCandidateReversedEdges
          ] );

          // Ensure match-ups
          if ( assertSlow ) {
            // Just check this for now
            assertSlow( outsideStartOutsideCandidateForwardEdges[ 0 ].startPoint.equalsEpsilon( outsideStartOutsideCandidateForwardEdges[ outsideStartOutsideCandidateForwardEdges.length - 1 ].endPoint, 1e-6 ) );
          }
        }

        outsideCandidateForwardEdges.length = 0;
        outsideCandidateReversedEdges.length = 0;
        outsideStartOutsideCandidateForwardEdges.length = 0;
        outsideStartOutsideCandidateReversedEdges.length = 0;
      }

      // TODO: should we assertion-check that these match up?
      if ( insideCandidateEdges.length ) {
        insideCandidatePolygons.push( insideCandidateEdges.slice() );
        insideCandidateEdges.length = 0;
      }
    }

    // Sort our critical angles, so we can iterate through unique values in-order
    angles = _.uniq( angles.sort( ( a, b ) => a - b ) );

    // We'll just add the start point(s)
    const addEdgeTo = ( edge: LinearEdge | CircularEdge, simplifier: ClipSimplifier ) => {
      if ( edge instanceof LinearEdge ) {
        simplifier.addPoint( edge.startPoint );
      }
      else {
        const startIndex = angles.indexOf( edge.startAngle );
        const endIndex = angles.indexOf( edge.endAngle );

        const subAngles: number[] = [];

        // Iterate (in the specific direction) through the angles we cover, and add them to our subAngles list.
        const dirSign = edge.counterClockwise ? 1 : -1;
        for ( let index = startIndex; index !== endIndex; index = ( index + dirSign + angles.length ) % angles.length ) {
          subAngles.push( angles[ index ] );
        }
        subAngles.push( angles[ endIndex ] );

        for ( let j = 0; j < subAngles.length - 1; j++ ) {
          const startAngle = subAngles[ j ];
          const endAngle = subAngles[ j + 1 ];

          // Skip "negligible" angles
          const absDiff = Math.abs( startAngle - endAngle );
          if ( absDiff < 1e-9 || Math.abs( absDiff - Math.PI * 2 ) < 1e-9 ) {
            continue;
          }

          // Put our end angle in the dirSign direction from our startAngle (if we're counterclockwise and our angle increases,
          // our relativeEndAngle should be greater than our startAngle, and similarly if we're clockwise and our angle decreases,
          // our relativeEndAngle should be less than our startAngle)
          const relativeEndAngle = ( edge.counterClockwise === ( startAngle < endAngle ) ) ? endAngle : endAngle + dirSign * Math.PI * 2;

          // Split our circular arc into segments!
          const angleDiff = relativeEndAngle - startAngle;
          const numSegments = Math.ceil( Math.abs( angleDiff ) / maxAngleSplit );
          for ( let k = 0; k < numSegments; k++ ) {
            const startTheta = startAngle + angleDiff * ( k / numSegments );
            const startPoint = Vector2.createPolar( radius, startTheta ).add( center );

            simplifier.addPoint( startPoint );
          }
        }
      }
    };

    let totalArea = 0; // For assertions

    const addPolygonTo = ( edges: ( LinearEdge | CircularEdge )[], polygons: Vector2[][] ) => {

      for ( let j = 0; j < edges.length; j++ ) {
        addEdgeTo( edges[ j ], simplifier );
      }

      const polygon = simplifier.finalize();

      if ( polygon.length >= 3 ) {
        polygons.push( polygon );

        if ( assertSlow ) {
          totalArea += new PolygonalFace( [ polygon ] ).getArea();
        }
      }
    };

    for ( let i = 0; i < insideCandidatePolygons.length; i++ ) {
      addPolygonTo( insideCandidatePolygons[ i ], inside );
    }

    for ( let i = 0; i < outsideCandidatePolygons.length; i++ ) {
      addPolygonTo( outsideCandidatePolygons[ i ], outside );
    }

    if ( assertSlow ) {
      const beforeArea = new PolygonalFace( polygons ).getArea();

      assertSlow( Math.abs( totalArea - beforeArea ) < 1e-5 );
    }
  }

  /**
   * Clips a polygon (represented by polygonal vertex lists) by a circle. This will output both the inside and outside,
   * appending vertices to the arrays.
   *
   * maxAngleSplit is the maximum angle of a circular arc that will be converted into a linear edge.
   *
   * TODO: test this!
   */
  public static binaryCircularTracingClipIterate(
    // TODO: can we do this from a stream of data instead?
    polygons: Vector2[][],
    center: Vector2,
    radius: number,
    maxAngleSplit: number,
    callback: BinaryClipCallback,
    polygonCompleteCallback: BinaryPolygonCompleteCallback
  ): void {

    const radiusSquared = radius * radius;

    // If we inscribed a circle inside a regular polygon split at angle `maxAngleSplit`, we'd have this radius.
    // Because we're turning our circular arcs into line segments at the end, we need to make sure that content inside
    // the circle doesn't go OUTSIDE the "inner" polygon (in that sliver between the circle and regular polygon).
    // We'll do that by adding "critical angles" for any points between the radius and inradus, so that our polygonal
    // approximation of the circle has a split there.
    // inradius = r cos( pi / n ) for n segments
    // n = 2pi / maxAngleSplit
    const inradius = radius * Math.cos( 0.5 * maxAngleSplit );

    // Our general plan will be to clip by keeping things "inside" the circle, and using the duality of clipping with
    // edges to also get the "outside" edges.
    // The duality follows from the fact that if we have a "full" polygon represented by edges, and then we have a
    // "subset" of it also represented by edges, then the "full - subset" difference can be represented by including
    // both all the edges of the "full" polygon PLUS all of the edges of the "subset" polygon with their direction
    // reversed.
    // Additionally in general, instead of "appending" both of those lists, we can do MUCH better! Instead whenever
    // we INCLUDE part of an original edge in the "subset", we DO NOT include it in the other disjoint polygon, and
    // vice versa. Additionally, when we add in "new" edges (or fake ones), we need to add the REVERSE to the
    // disjoint polygon.
    // Thus we essentially get "dual" binary polygons for free.

    // Because we are clipping to "keep the inside", any edges outside we can actually just "project" down to the circle
    // (imagine wrapping the exterior edge around the circle). For the duality, we can output the internal/external
    // "parts" directly to the inside/outside result arrays, but these wrapped circular projections will need to be
    // stored for later here.
    // Each "edge" in our input will have between 0 and 1 "internal" edges, and 0 and 2 "external" edges.

    // Because we're handling the polygonal form, we'll need to do some complicated handling for the outside. Whenever
    // we have a transition to the outside (at a specific point), we'll start recording the "outside" edges in one
    // "forward" list, and the corresponding circular movements in the "reverse" list (it will be in the wrong order,
    // and will be reversed later). Once our polygon goes back inside, we'll be able to stitch these together to create
    // an "outside" polygon (forward edges + reversed reverse edges).

    // This gets TRICKIER because if we start outside, we'll have an "unclosed" section of a polygon. We'll need to
    // store THOSE edges in the "outsideStartOutside" list, so that once we finish the polygon, we can rejoin them with
    // the other unprocessed "outside" edges.

    // We'll need to detect crossings of the circle, so that we can "join" the outside edges together. This is somewhat
    // complicated by the fact that the endpoints of a segment may be on the circle, so one edge might be fully
    // internal, and the next might be fully external. We'll use an epsilon to detect this.

    // -------------

    // Our edges of output polygons (that will need to be "split up" if they are circular) will be stored here. These
    // are in "final" form, except for the splitting.
    const insideCandidatePolygons: ( LinearEdge | CircularEdge )[][] = [];
    const outsideCandidatePolygons: ( LinearEdge | CircularEdge )[][] = [];

    // Our "inside" edges are always stored in the "forward" order. For every input polygon, we'll push here and then
    // put this into the insideCandidatePolygons array (one input polygon to one potential output polygon).
    const insideCandidateEdges: ( LinearEdge | CircularEdge )[] = [];

    // The arrays we push outside edges when hasOutsideStartPoint = false. When we have a crossing, we'll have a
    // complete outside polygon to push to outsideCandidatePolygons.
    const outsideCandidateForwardEdges: LinearEdge[] = [];
    const outsideCandidateReversedEdges: CircularEdge[] = [];

    // We'll need to handle the cases where we start "outside", and thus don't have the matching "outside" edges yet.
    // If we have an outside start point, we'll need to store the edges until we are completely done with that input
    // polygon, then will connect them up!
    let hasOutsideStartPoint = false;
    let hasInsidePoint = false;
    const outsideStartOutsideCandidateForwardEdges: LinearEdge[] = [];
    const outsideStartOutsideCandidateReversedEdges: CircularEdge[] = [];

    // We'll also need to store "critical" angles for the future polygonalization of the circles. If we were outputting
    // true circular edges, we could just include `insideCircularEdges`, however we want to convert it to line segments
    // so that future stages don't have to deal with this.
    // We'll need the angles so that those points on the circle will be exact (for ALL of the circular edges).
    // This is because we may be wrapping back-and-forth across the circle multiple times, with different start/end
    // angles, and we need the polygonal parts of these overlaps to be identical (to avoid precision issues later,
    // and ESPECIALLY to avoid little polygonal bits with "negative" area where the winding orientation is flipped.
    // There are two types of points where we'll need to store the angles:
    // 1. Intersections with our circle (where we'll need to "split" the edge into two at that point)
    // 2. Points where we are between the circumradius and inradius of the roughest "regular" polygon we might generate.

    // Because we need to output polygon data in order, we'll need to process ALL of the data, determine the angles,
    // and then output all of it.

    // between [-pi,pi], from atan2, tracked so we can turn the arcs piecewise-linear in a consistent fashion later
    let angles: number[] = [];

    const processCrossing = () => {
      // We crossed! Now our future "outside" handling will have a "joined" start point
      hasOutsideStartPoint = false;

      if ( outsideCandidateForwardEdges.length ) {
        outsideCandidateReversedEdges.reverse();

        // Ensure that our start and end points match up
        if ( assert ) {
          const startEdgePoint = outsideCandidateForwardEdges[ 0 ].startPoint;
          const endEdgePoint = outsideCandidateForwardEdges[ outsideCandidateForwardEdges.length - 1 ].endPoint;
          const startRadialPoint = Vector2.createPolar( radius, outsideCandidateReversedEdges[ 0 ].startAngle ).add( center );
          const endRadialPoint = Vector2.createPolar( radius, outsideCandidateReversedEdges[ outsideCandidateReversedEdges.length - 1 ].endAngle ).add( center );

          assert( startEdgePoint.equalsEpsilon( endRadialPoint, 1e-6 ) );
          assert( endEdgePoint.equalsEpsilon( startRadialPoint, 1e-6 ) );
        }

        const candidatePolygon = [
          ...outsideCandidateForwardEdges,
          ...outsideCandidateReversedEdges
        ];
        outsideCandidatePolygons.push( candidatePolygon );

        outsideCandidateForwardEdges.length = 0;
        outsideCandidateReversedEdges.length = 0;
      }
    };

    // Process a fully-inside-the-circle part of an edge
    const processInternal = ( start: Vector2, end: Vector2 ) => {
      insideCandidateEdges.push( new LinearEdge( start, end ) );

      const localStart = start.minus( center );
      const localEnd = end.minus( center );

      // We're already inside the circle, so the circumradius check isn't needed. If we're inside the inradius,
      // ensure the critical angles are added.
      if ( localStart.magnitude > inradius ) {
        angles.push( localStart.angle );
      }
      if ( localEnd.magnitude > inradius ) {
        angles.push( localEnd.angle );
      }
    };

    // Process a fully-outside-the-circle part of an edge
    const processExternal = ( start: Vector2, end: Vector2 ) => {

      if ( hasOutsideStartPoint ) {
        outsideStartOutsideCandidateForwardEdges.push( new LinearEdge( start, end ) );
      }
      else {
        outsideCandidateForwardEdges.push( new LinearEdge( start, end ) );
      }

      const localStart = start.minus( center );
      const localEnd = end.minus( center );

      // Modify (project) them into points of the given radius.
      localStart.multiplyScalar( radius / localStart.magnitude );
      localEnd.multiplyScalar( radius / localEnd.magnitude );

      // Handle projecting the edge to the circle.
      // We'll only need to do extra work if the projected points are not equal. If we had a line that was pointed
      // toward the center of the circle, it would project down to a single point, and we wouldn't have any contribution.
      if ( !localStart.equalsEpsilon( localEnd, 1e-8 ) ) {
        // Check to see which way we went "around" the circle

        // (y, -x) perpendicular, so a clockwise pi/2 rotation
        const isClockwise = localStart.perpendicular.dot( localEnd ) > 0;

        const startAngle = localStart.angle;
        const endAngle = localEnd.angle;

        angles.push( startAngle );
        angles.push( endAngle );

        insideCandidateEdges.push( new CircularEdge( startAngle, endAngle, !isClockwise ) );
        if ( hasOutsideStartPoint ) {
          // TODO: fish out this circular edge, we're using it for both
          outsideStartOutsideCandidateReversedEdges.push( new CircularEdge( endAngle, startAngle, isClockwise ) );
        }
        else {
          outsideCandidateReversedEdges.push( new CircularEdge( endAngle, startAngle, isClockwise ) );
        }
      }
    };

    // Stage to process the edges into the insideCandidatesPolygons/outsideCandidatesPolygons arrays.
    for ( let i = 0; i < polygons.length; i++ ) {
      const polygon = polygons[ i ];

      for ( let j = 0; j < polygon.length; j++ ) {
        const start = polygon[ j ];
        const end = polygon[ ( j + 1 ) % polygon.length ];

        const p0x = start.x - center.x;
        const p0y = start.y - center.y;
        const p1x = end.x - center.x;
        const p1y = end.y - center.y;

        // We'll use squared comparisons to avoid square roots
        const startDistanceSquared = p0x * p0x + p0y * p0y;
        const endDistanceSquared = p1x * p1x + p1y * p1y;

        const startInside = startDistanceSquared <= radiusSquared;
        const endInside = endDistanceSquared <= radiusSquared;

        // If we meet these thresholds, we'll process a crossing
        const startOnCircle = Math.abs( startDistanceSquared - radiusSquared ) < 1e-8;
        const endOnCircle = Math.abs( endDistanceSquared - radiusSquared ) < 1e-8;

        // If we're the first edge, set up our starting conditions
        if ( j === 0 ) {
          hasOutsideStartPoint = !startInside && !startOnCircle;
          hasInsidePoint = startInside || endInside;
        }
        else {
          hasInsidePoint = hasInsidePoint || startInside || endInside;
        }

        // If the endpoints are within the circle, the entire contents will be also (shortcut)
        if ( startInside && endInside ) {
          processInternal( start, end );
          if ( startOnCircle || endOnCircle ) {
            processCrossing();
          }
          continue;
        }

        // Now, we'll solve for the t-values of the intersection of the line and the circle.
        // e.g. p0 + t * ( p1 - p0 ) will be on the circle. This is solvable with a quadratic equation.

        const dx = p1x - p0x;
        const dy = p1y - p0y;

        // quadratic to solve
        const a = dx * dx + dy * dy;
        const b = 2 * ( p0x * dx + p0y * dy );
        const c = p0x * p0x + p0y * p0y - radius * radius;

        assert && assert( a > 0, 'We should have a delta, assumed in code below' );

        const roots = solveQuadraticRootsReal( a, b, c );

        let isFullyExternal = false;

        // If we have no roots, we're fully outside the circle!
        if ( !roots || roots.length === 0 ) {
          isFullyExternal = true;
        }
        else {
          if ( roots.length === 1 ) {
            roots.push( roots[ 0 ] );
          }
          assert && assert( roots[ 0 ] <= roots[ 1 ], 'Easier for us to assume root ordering' );
          const rootA = roots[ 0 ];
          const rootB = roots[ 1 ];

          if ( rootB <= 0 || rootA >= 1 ) {
            isFullyExternal = true;
          }

          // If our roots are identical, we are TANGENT to the circle. We can consider this to be fully external, since
          // there will not be an internal section.
          if ( rootA === rootB ) {
            isFullyExternal = true;
          }
        }

        if ( isFullyExternal ) {
          processExternal( start, end );
          continue;
        }

        assert && assert( roots![ 0 ] <= roots![ 1 ], 'Easier for us to assume root ordering' );
        const rootA = roots![ 0 ];
        const rootB = roots![ 1 ];

        // Compute intersection points (when the t values are in the range [0,1])
        const rootAInSegment = rootA > 0 && rootA < 1;
        const rootBInSegment = rootB > 0 && rootB < 1;
        const deltaPoints = end.minus( start );
        const rootAPoint = rootAInSegment ? ( start.plus( deltaPoints.timesScalar( rootA ) ) ) : Vector2.ZERO; // ignore the zero, it's mainly for typing
        const rootBPoint = rootBInSegment ? ( start.plus( deltaPoints.timesScalar( rootB ) ) ) : Vector2.ZERO; // ignore the zero, it's mainly for typing

        if ( rootAInSegment && rootBInSegment ) {
          processExternal( start, rootAPoint );
          processCrossing();
          processInternal( rootAPoint, rootBPoint );
          processCrossing();
          processExternal( rootBPoint, end );
        }
        else if ( rootAInSegment ) {
          processExternal( start, rootAPoint );
          processCrossing();
          processInternal( rootAPoint, end );
          if ( endOnCircle ) {
            processCrossing();
          }
        }
        else if ( rootBInSegment ) {
          if ( startOnCircle ) {
            processCrossing();
          }
          processInternal( start, rootBPoint );
          processCrossing();
          processExternal( rootBPoint, end );
        }
        else {
          assert && assert( false, 'Should not reach this point, due to the boolean constraints above' );
        }
      }

      // We finished the input polygon! Now we need to connect up things if we started outside.
      if ( outsideCandidateForwardEdges.length || outsideStartOutsideCandidateForwardEdges.length ) {
        // We... really should have both? Let's be permissive with epsilon checks?

        outsideCandidateReversedEdges.reverse();
        outsideStartOutsideCandidateReversedEdges.reverse();

        if ( hasInsidePoint ) {
          const candidatePolygon = [
            ...outsideCandidateForwardEdges,
            ...outsideStartOutsideCandidateForwardEdges,
            ...outsideStartOutsideCandidateReversedEdges,
            ...outsideCandidateReversedEdges
          ];
          outsideCandidatePolygons.push( candidatePolygon );

          // Ensure that all of our points must match up
          if ( assertSlow ) {
            for ( let i = 0; i < candidatePolygon.length; i++ ) {
              const edge = candidatePolygon[ i ];
              const nextEdge = candidatePolygon[ ( i + 1 ) % candidatePolygon.length ];

              const endPoint = edge instanceof LinearEdge ? edge.endPoint : Vector2.createPolar( radius, edge.endAngle ).add( center );
              const startPoint = nextEdge instanceof LinearEdge ? nextEdge.startPoint : Vector2.createPolar( radius, nextEdge.startAngle ).add( center );

              assertSlow( endPoint.equalsEpsilon( startPoint, 1e-6 ) );
            }
          }
        }
        else {
          // If we're fully external, we'll need to create two paths
          outsideCandidatePolygons.push( [
            ...outsideStartOutsideCandidateForwardEdges
          ] );
          outsideCandidatePolygons.push( [
            ...outsideStartOutsideCandidateReversedEdges
          ] );

          // Ensure match-ups
          if ( assertSlow ) {
            // Just check this for now
            assertSlow( outsideStartOutsideCandidateForwardEdges[ 0 ].startPoint.equalsEpsilon( outsideStartOutsideCandidateForwardEdges[ outsideStartOutsideCandidateForwardEdges.length - 1 ].endPoint, 1e-6 ) );
          }
        }

        outsideCandidateForwardEdges.length = 0;
        outsideCandidateReversedEdges.length = 0;
        outsideStartOutsideCandidateForwardEdges.length = 0;
        outsideStartOutsideCandidateReversedEdges.length = 0;
      }

      // TODO: should we assertion-check that these match up?
      if ( insideCandidateEdges.length ) {
        insideCandidatePolygons.push( insideCandidateEdges.slice() );
        insideCandidateEdges.length = 0;
      }
    }

    // Sort our critical angles, so we can iterate through unique values in-order
    angles = _.uniq( angles.sort( ( a, b ) => a - b ) );

    // We'll just add the start point(s)
    const addEdgeTo = ( edge: LinearEdge | CircularEdge, isInside: boolean ) => {
      if ( edge instanceof LinearEdge ) {
        const startPoint = edge.startPoint;
        const endPoint = edge.endPoint;
        callback( isInside, startPoint.x, startPoint.y, endPoint.x, endPoint.y, startPoint, endPoint );
      }
      else {
        const startIndex = angles.indexOf( edge.startAngle );
        const endIndex = angles.indexOf( edge.endAngle );

        const subAngles: number[] = [];

        // Iterate (in the specific direction) through the angles we cover, and add them to our subAngles list.
        const dirSign = edge.counterClockwise ? 1 : -1;
        for ( let index = startIndex; index !== endIndex; index = ( index + dirSign + angles.length ) % angles.length ) {
          subAngles.push( angles[ index ] );
        }
        subAngles.push( angles[ endIndex ] );

        for ( let j = 0; j < subAngles.length - 1; j++ ) {
          const startAngle = subAngles[ j ];
          const endAngle = subAngles[ j + 1 ];

          // Skip "negligible" angles
          const absDiff = Math.abs( startAngle - endAngle );
          if ( absDiff < 1e-9 || Math.abs( absDiff - Math.PI * 2 ) < 1e-9 ) {
            continue;
          }

          // Put our end angle in the dirSign direction from our startAngle (if we're counterclockwise and our angle increases,
          // our relativeEndAngle should be greater than our startAngle, and similarly if we're clockwise and our angle decreases,
          // our relativeEndAngle should be less than our startAngle)
          const relativeEndAngle = ( edge.counterClockwise === ( startAngle < endAngle ) ) ? endAngle : endAngle + dirSign * Math.PI * 2;

          // Split our circular arc into segments!
          const angleDiff = relativeEndAngle - startAngle;
          const numSegments = Math.ceil( Math.abs( angleDiff ) / maxAngleSplit );
          for ( let k = 0; k < numSegments; k++ ) {
            const startTheta = startAngle + angleDiff * ( k / numSegments );
            const startX = radius * Math.cos( startTheta ) + center.x;
            const startY = radius * Math.sin( startTheta ) + center.y;

            // TODO: if we use accumulators directly, we could avoid computing more points than necessary?
            // TODO: OR we could just save the data from the previous point...
            const endTheta = startAngle + angleDiff * ( ( k + 1 ) / numSegments );
            const endX = radius * Math.cos( endTheta ) + center.x;
            const endY = radius * Math.sin( endTheta ) + center.y;

            callback( isInside, startX, startY, endX, endY, null, null );
          }
        }
      }
    };

    const addPolygonTo = ( edges: ( LinearEdge | CircularEdge )[], isInside: boolean ) => {

      for ( let j = 0; j < edges.length; j++ ) {
        addEdgeTo( edges[ j ], isInside );
      }

      polygonCompleteCallback( isInside );
    };

    for ( let i = 0; i < insideCandidatePolygons.length; i++ ) {
      addPolygonTo( insideCandidatePolygons[ i ], true );
    }

    for ( let i = 0; i < outsideCandidatePolygons.length; i++ ) {
      addPolygonTo( outsideCandidatePolygons[ i ], false );
    }

    // TODO: have total area checks somewhere else (we used to check it here)
  }
}

// Stores data for binaryCircularClipPolygon
class CircularEdge {
  public constructor(
    public readonly startAngle: number,
    public readonly endAngle: number,
    public readonly counterClockwise: boolean
  ) {}
}

// Stores data for binaryCircularClipEdges
class CircularEdgeWithPoints {
  public constructor(
    public readonly startPoint: Vector2 | null,
    public readonly endPoint: Vector2 | null,
    public readonly startAngle: number,
    public readonly endAngle: number,
    public readonly counterClockwise: boolean
  ) {}
}

alpenglow.register( 'CircularClipping', CircularClipping );


const minSimplifier = new ClipSimplifier();
const maxSimplifier = new ClipSimplifier();

export type BinaryClipCallback = (
  isMinFace: boolean,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  startPoint: Vector2 | null,
  endPoint: Vector2 | null
) => void;

export type PolygonCompleteCallback = () => void;

export type BinaryPolygonCompleteCallback = (
  isMinFace: boolean
) => void;

/**
 * Clipping arbitrary (degenerate, non-convex, self-intersecting, etc.) polygons based on binary criteria (e.g.
 * left/right, inside/outside).
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */
export class BinaryClipping {

  // Returns if all done
  private static binaryInitialPush(
    startPoint: Vector2,
    endPoint: Vector2,
    startCmp: number,
    endCmp: number,
    minLinearEdges: LinearEdge[],
    maxLinearEdges: LinearEdge[]
  ): boolean {

    // both values less than the split
    if ( startCmp === -1 && endCmp === -1 ) {
      minLinearEdges.push( new LinearEdge( startPoint, endPoint ) );
      return true;
    }

    // both values greater than the split
    if ( startCmp === 1 && endCmp === 1 ) {
      maxLinearEdges.push( new LinearEdge( startPoint, endPoint ) );
      return true;
    }

    // both values equal to the split
    if ( startCmp === 0 && endCmp === 0 ) {
      // vertical/horizontal line ON our clip point. It is considered "inside" both, so we can just simply push it to both
      minLinearEdges.push( new LinearEdge( startPoint, endPoint ) );
      maxLinearEdges.push( new LinearEdge( startPoint, endPoint ) );
      return true;
    }

    return false;
  }

  private static binaryPushClipEdges(
    startPoint: Vector2,
    endPoint: Vector2,
    startCmp: number,
    endCmp: number,
    fakeCorner: Vector2,
    intersection: Vector2,
    minLinearEdges: LinearEdge[],
    maxLinearEdges: LinearEdge[]
  ): void {
    const startLess = startCmp === -1;
    const startGreater = startCmp === 1;
    const endLess = endCmp === -1;
    const endGreater = endCmp === 1;

    const minResultStartPoint = startLess ? startPoint : intersection;
    const minResultEndPoint = endLess ? endPoint : intersection;
    const maxResultStartPoint = startGreater ? startPoint : intersection;
    const maxResultEndPoint = endGreater ? endPoint : intersection;

    // min-start corner
    if ( startGreater && !fakeCorner.equals( minResultStartPoint ) ) {
      minLinearEdges.push( new LinearEdge( fakeCorner, minResultStartPoint, true ) );
    }

    // main min section
    if ( !minResultStartPoint.equals( minResultEndPoint ) ) {
      minLinearEdges.push( new LinearEdge( minResultStartPoint, minResultEndPoint ) );
    }

    // min-end corner
    if ( endGreater && !fakeCorner.equals( minResultEndPoint ) ) {
      minLinearEdges.push( new LinearEdge( minResultEndPoint, fakeCorner, true ) );
    }

    // max-start corner
    if ( startLess && !fakeCorner.equals( maxResultStartPoint ) ) {
      maxLinearEdges.push( new LinearEdge( fakeCorner, maxResultStartPoint, true ) );
    }

    // main max section
    if ( !maxResultStartPoint.equals( maxResultEndPoint ) ) {
      maxLinearEdges.push( new LinearEdge( maxResultStartPoint, maxResultEndPoint ) );
    }

    // max-end corner
    if ( endLess && !fakeCorner.equals( maxResultEndPoint ) ) {
      maxLinearEdges.push( new LinearEdge( maxResultEndPoint, fakeCorner, true ) );
    }
  }

  public static binaryXClipEdge(
    startPoint: Vector2,
    endPoint: Vector2,
    x: number,
    fakeCornerY: number,
    minLinearEdges: LinearEdge[], // Will append into this (for performance)
    maxLinearEdges: LinearEdge[] // Will append into this (for performance)
  ): void {

    const startCmp = Math.sign( startPoint.x - x );
    const endCmp = Math.sign( endPoint.x - x );

    const handled = this.binaryInitialPush(
      startPoint, endPoint,
      startCmp, endCmp,
      minLinearEdges, maxLinearEdges
    );
    if ( handled ) {
      return;
    }

    // There is a single crossing of our x.
    const y = startPoint.y + ( endPoint.y - startPoint.y ) * ( x - startPoint.x ) / ( endPoint.x - startPoint.x );
    const intersection = new Vector2( x, y );
    const fakeCorner = new Vector2( x, fakeCornerY );

    BinaryClipping.binaryPushClipEdges(
      startPoint, endPoint,
      startCmp, endCmp,
      fakeCorner,
      intersection,
      minLinearEdges, maxLinearEdges
    );
  }

  public static binaryYClipEdge(
    startPoint: Vector2,
    endPoint: Vector2,
    y: number,
    fakeCornerX: number,
    minLinearEdges: LinearEdge[], // Will append into this (for performance)
    maxLinearEdges: LinearEdge[] // Will append into this (for performance)
  ): void {

    const startCmp = Math.sign( startPoint.y - y );
    const endCmp = Math.sign( endPoint.y - y );

    const handled = this.binaryInitialPush(
      startPoint, endPoint,
      startCmp, endCmp,
      minLinearEdges, maxLinearEdges
    );
    if ( handled ) {
      return;
    }

    // There is a single crossing of our y.
    const x = startPoint.x + ( endPoint.x - startPoint.x ) * ( y - startPoint.y ) / ( endPoint.y - startPoint.y );
    const intersection = new Vector2( x, y );
    const fakeCorner = new Vector2( fakeCornerX, y );

    BinaryClipping.binaryPushClipEdges(
      startPoint, endPoint,
      startCmp, endCmp,
      fakeCorner,
      intersection,
      minLinearEdges, maxLinearEdges
    );
  }

  // line where dot( normal, point ) - value = 0. "min" side is dot-products < value, "max" side is dot-products > value
  public static binaryLineClipEdge(
    startPoint: Vector2,
    endPoint: Vector2,
    normal: Vector2, // NOTE: does NOT need to be a unit vector
    value: number,
    fakeCornerPerpendicular: number,
    minLinearEdges: LinearEdge[], // Will append into this (for performance)
    maxLinearEdges: LinearEdge[] // Will append into this (for performance)
  ): void {

    const startDot = normal.dot( startPoint );
    const endDot = normal.dot( endPoint );

    const startCmp = Math.sign( startDot - value );
    const endCmp = Math.sign( endDot - value );

    const handled = this.binaryInitialPush(
      startPoint, endPoint,
      startCmp, endCmp,
      minLinearEdges, maxLinearEdges
    );
    if ( handled ) {
      return;
    }

    const perpendicular = normal.perpendicular;

    const startPerp = perpendicular.dot( startPoint );
    const endPerp = perpendicular.dot( endPoint );
    const perpPerp = perpendicular.dot( perpendicular );

    // There is a single crossing of our line
    const intersectionPerp = startPerp + ( endPerp - startPerp ) * ( value - startDot ) / ( endDot - startDot );

    // TODO: pass in the fake corner / basePoint for efficiency?
    const basePoint = normal.timesScalar( value / normal.dot( normal ) );

    const intersection = perpendicular.timesScalar( intersectionPerp / perpPerp ).add( basePoint );
    const fakeCorner = perpendicular.timesScalar( fakeCornerPerpendicular ).add( basePoint );

    BinaryClipping.binaryPushClipEdges(
      startPoint, endPoint,
      startCmp, endCmp,
      fakeCorner,
      intersection,
      minLinearEdges, maxLinearEdges
    );
  }

  public static binaryXClipPolygon(
    polygon: Vector2[],
    x: number,
    minPolygon: Vector2[], // Will append into this (for performance)
    maxPolygon: Vector2[] // Will append into this (for performance)
  ): void {
    for ( let i = 0; i < polygon.length; i++ ) {
      const startPoint = polygon[ i ];
      const endPoint = polygon[ ( i + 1 ) % polygon.length ];

      if ( startPoint.x < x && endPoint.x < x ) {
        minSimplifier.add( endPoint.x, endPoint.y );
        continue;
      }
      else if ( startPoint.x > x && endPoint.x > x ) {
        maxSimplifier.add( endPoint.x, endPoint.y );
        continue;
      }
      else if ( startPoint.x === x && endPoint.x === x ) {
        // vertical line ON our clip point. It is considered "inside" both, so we can just simply push it to both
        minSimplifier.add( endPoint.x, endPoint.y );
        maxSimplifier.add( endPoint.x, endPoint.y );
        continue;
      }

      // There is a single crossing of our x.
      const y = startPoint.y + ( endPoint.y - startPoint.y ) * ( x - startPoint.x ) / ( endPoint.x - startPoint.x );

      const startSimplifier = startPoint.x < endPoint.x ? minSimplifier : maxSimplifier;
      const endSimplifier = startPoint.x < endPoint.x ? maxSimplifier : minSimplifier;

      startSimplifier.add( x, y );
      endSimplifier.add( x, y );
      endSimplifier.add( endPoint.x, endPoint.y );
    }

    minPolygon.push( ...minSimplifier.finalize() );
    maxPolygon.push( ...maxSimplifier.finalize() );
  }

  public static binaryYClipPolygon(
    polygon: Vector2[],
    y: number,
    minPolygon: Vector2[], // Will append into this (for performance)
    maxPolygon: Vector2[] // Will append into this (for performance)
  ): void {
    for ( let i = 0; i < polygon.length; i++ ) {
      const startPoint = polygon[ i ];
      const endPoint = polygon[ ( i + 1 ) % polygon.length ];

      if ( startPoint.y < y && endPoint.y < y ) {
        minSimplifier.add( endPoint.x, endPoint.y );
        continue;
      }
      else if ( startPoint.y > y && endPoint.y > y ) {
        maxSimplifier.add( endPoint.x, endPoint.y );
        continue;
      }
      else if ( startPoint.y === y && endPoint.y === y ) {
        // horizontal line ON our clip point. It is considered "inside" both, so we can just simply push it to both
        minSimplifier.add( endPoint.x, endPoint.y );
        maxSimplifier.add( endPoint.x, endPoint.y );
        continue;
      }

      // There is a single crossing of our y.
      const x = startPoint.x + ( endPoint.x - startPoint.x ) * ( y - startPoint.y ) / ( endPoint.y - startPoint.y );

      const startSimplifier = startPoint.y < endPoint.y ? minSimplifier : maxSimplifier;
      const endSimplifier = startPoint.y < endPoint.y ? maxSimplifier : minSimplifier;

      startSimplifier.add( x, y );
      endSimplifier.add( x, y );
      endSimplifier.add( endPoint.x, endPoint.y );
    }

    minPolygon.push( ...minSimplifier.finalize() );
    maxPolygon.push( ...maxSimplifier.finalize() );
  }

  // line where dot( normal, point ) - value = 0. "min" side is dot-products < value, "max" side is dot-products > value
  public static binaryLineClipPolygon(
    polygon: Vector2[],
    normal: Vector2, // NOTE: does NOT need to be a unit vector
    value: number,
    minPolygon: Vector2[], // Will append into this (for performance)
    maxPolygon: Vector2[] // Will append into this (for performance)
  ): void {

    const perpendicular = normal.perpendicular;
    const basePoint = normal.timesScalar( value / normal.dot( normal ) );
    const perpPerp = perpendicular.dot( perpendicular );

    for ( let i = 0; i < polygon.length; i++ ) {
      const startPoint = polygon[ i ];
      const endPoint = polygon[ ( i + 1 ) % polygon.length ];

      const startDot = normal.dot( startPoint );
      const endDot = normal.dot( endPoint );

      if ( startDot < value && endDot < value ) {
        minSimplifier.add( endPoint.x, endPoint.y );
        continue;
      }
      else if ( startDot > value && endDot > value ) {
        maxSimplifier.add( endPoint.x, endPoint.y );
        continue;
      }
      else if ( startDot === value && endDot === value ) {
        // line ON our clip point. It is considered "inside" both, so we can just simply push it to both
        minSimplifier.add( endPoint.x, endPoint.y );
        maxSimplifier.add( endPoint.x, endPoint.y );
        continue;
      }

      const startPerp = perpendicular.dot( startPoint );
      const endPerp = perpendicular.dot( endPoint );

      const intersectionPerp = startPerp + ( endPerp - startPerp ) * ( value - startDot ) / ( endDot - startDot );

      // There is a single crossing of our line.
      const intersection = perpendicular.timesScalar( intersectionPerp / perpPerp ).add( basePoint );

      const startSimplifier = startDot < endDot ? minSimplifier : maxSimplifier;
      const endSimplifier = startDot < endDot ? maxSimplifier : minSimplifier;

      startSimplifier.add( intersection.x, intersection.y );
      endSimplifier.add( intersection.x, intersection.y );
      endSimplifier.add( endPoint.x, endPoint.y );
    }

    minPolygon.push( ...minSimplifier.finalize() );
    maxPolygon.push( ...maxSimplifier.finalize() );
  }

  public static binaryXClipEdgedClipped(
    face: EdgedClippedFace,
    x: number
  ): { minFace: EdgedClippedFace; maxFace: EdgedClippedFace } {

    const minEdges: LinearEdge[] = [];
    const maxEdges: LinearEdge[] = [];
    let minCount = 0;
    let maxCount = 0;

    const centerY = 0.5 * ( face.minY + face.maxY );

    const edges = face.edges;
    for ( let i = 0; i < edges.length; i++ ) {
      const edge = edges[ i ];
      const startPoint = edge.startPoint;
      const endPoint = edge.endPoint;

      // TODO: with fastmath, will these be equivalent?
      const startCmp = Math.sign( startPoint.x - x );
      const endCmp = Math.sign( endPoint.x - x );
      const startYLess = startPoint.y < centerY;
      const endYLess = endPoint.y < centerY;

      // both values less than the split
      if ( startCmp === -1 && endCmp === -1 ) {
        minEdges.push( edge );

        if ( startYLess !== endYLess ) {
          maxCount += startYLess ? 1 : -1;
        }
      }
      // both values greater than the split
      else if ( startCmp === 1 && endCmp === 1 ) {
        maxEdges.push( edge );

        if ( startYLess !== endYLess ) {
          minCount += startYLess ? 1 : -1;
        }
      }
      // both values equal to the split
      else if ( startCmp === 0 && endCmp === 0 ) {
        // vertical/horizontal line ON our clip point. It is considered "inside" both, so we can just simply push it to both
        minEdges.push( edge );
        maxEdges.push( edge );
      }
      else {
        // There is a single crossing of our x (possibly on a start or end point)
        const y = startPoint.y + ( endPoint.y - startPoint.y ) * ( x - startPoint.x ) / ( endPoint.x - startPoint.x );
        const intersection = new Vector2( x, y );

        const startLess = startCmp === -1;
        const startGreater = startCmp === 1;
        const endLess = endCmp === -1;
        const endGreater = endCmp === 1;

        const minResultStartPoint = startLess ? startPoint : intersection;
        const minResultEndPoint = endLess ? endPoint : intersection;
        const maxResultStartPoint = startGreater ? startPoint : intersection;
        const maxResultEndPoint = endGreater ? endPoint : intersection;

        const startCornerY = startYLess ? face.minY : face.maxY;
        const endCornerY = endYLess ? face.minY : face.maxY;

        // min-start corner
        if ( startGreater && minResultStartPoint.y !== startCornerY ) {
          minEdges.push( new LinearEdge( new Vector2( x, startCornerY ), minResultStartPoint ) );
        }

        // main min section
        if ( !minResultStartPoint.equals( minResultEndPoint ) ) {
          minEdges.push( new LinearEdge( minResultStartPoint, minResultEndPoint ) );
        }

        // min-end corner
        if ( endGreater && minResultEndPoint.y !== endCornerY ) {
          minEdges.push( new LinearEdge( minResultEndPoint, new Vector2( x, endCornerY ) ) );
        }

        // max-start corner
        if ( startLess && maxResultStartPoint.y !== startCornerY ) {
          maxEdges.push( new LinearEdge( new Vector2( x, startCornerY ), maxResultStartPoint ) );
        }

        // main max section
        if ( !maxResultStartPoint.equals( maxResultEndPoint ) ) {
          maxEdges.push( new LinearEdge( maxResultStartPoint, maxResultEndPoint ) );
        }

        // max-end corner
        if ( endLess && maxResultEndPoint.y !== endCornerY ) {
          maxEdges.push( new LinearEdge( maxResultEndPoint, new Vector2( x, endCornerY ) ) );
        }
      }
    }

    const minFace = new EdgedClippedFace(
      minEdges,
      face.minX, face.minY, x, face.maxY,
      face.minXCount, face.minYCount, face.maxXCount + minCount, face.maxYCount
    );
    const maxFace = new EdgedClippedFace(
      maxEdges,
      x, face.minY, face.maxX, face.maxY,
      face.minXCount + maxCount, face.minYCount, face.maxXCount, face.maxYCount
    );

    if ( assertSlow ) {
      assertSlow( Math.abs( face.getArea() - minFace.getArea() - maxFace.getArea() ) < 1e-4 );
    }

    return {
      minFace: minFace,
      maxFace: maxFace
    };
  }

  public static binaryYClipEdgedClipped(
    face: EdgedClippedFace,
    y: number
  ): { minFace: EdgedClippedFace; maxFace: EdgedClippedFace } {

    const minEdges: LinearEdge[] = [];
    const maxEdges: LinearEdge[] = [];
    let minCount = 0;
    let maxCount = 0;

    const centerX = 0.5 * ( face.minX + face.maxX );

    const edges = face.edges;
    for ( let i = 0; i < edges.length; i++ ) {
      const edge = edges[ i ];
      const startPoint = edge.startPoint;
      const endPoint = edge.endPoint;

      // TODO: with fastmath, will these be equivalent?
      const startCmp = Math.sign( startPoint.y - y );
      const endCmp = Math.sign( endPoint.y - y );
      const startXLess = startPoint.x < centerX;
      const endXLess = endPoint.x < centerX;

      // both values less than the split
      if ( startCmp === -1 && endCmp === -1 ) {
        minEdges.push( edge );

        if ( startXLess !== endXLess ) {
          maxCount += startXLess ? 1 : -1;
        }
      }
      // both values greater than the split
      else if ( startCmp === 1 && endCmp === 1 ) {
        maxEdges.push( edge );

        if ( startXLess !== endXLess ) {
          minCount += startXLess ? 1 : -1;
        }
      }
      // both values equal to the split
      else if ( startCmp === 0 && endCmp === 0 ) {
        // vertical/horizontal line ON our clip point. It is considered "inside" both, so we can just simply push it to both
        minEdges.push( edge );
        maxEdges.push( edge );
      }
      else {
        // There is a single crossing of our y (possibly on a start or end point)
        const x = startPoint.x + ( endPoint.x - startPoint.x ) * ( y - startPoint.y ) / ( endPoint.y - startPoint.y );
        const intersection = new Vector2( x, y );

        const startLess = startCmp === -1;
        const startGreater = startCmp === 1;
        const endLess = endCmp === -1;
        const endGreater = endCmp === 1;

        const minResultStartPoint = startLess ? startPoint : intersection;
        const minResultEndPoint = endLess ? endPoint : intersection;
        const maxResultStartPoint = startGreater ? startPoint : intersection;
        const maxResultEndPoint = endGreater ? endPoint : intersection;

        const startCornerX = startXLess ? face.minX : face.maxX;
        const endCornerX = endXLess ? face.minX : face.maxX;

        // min-start corner
        if ( startGreater && minResultStartPoint.x !== startCornerX ) {
          minEdges.push( new LinearEdge( new Vector2( startCornerX, y ), minResultStartPoint ) );
        }

        // main min section
        if ( !minResultStartPoint.equals( minResultEndPoint ) ) {
          minEdges.push( new LinearEdge( minResultStartPoint, minResultEndPoint ) );
        }

        // min-end corner
        if ( endGreater && minResultEndPoint.x !== endCornerX ) {
          minEdges.push( new LinearEdge( minResultEndPoint, new Vector2( endCornerX, y ) ) );
        }

        // max-start corner
        if ( startLess && maxResultStartPoint.x !== startCornerX ) {
          maxEdges.push( new LinearEdge( new Vector2( startCornerX, y ), maxResultStartPoint ) );
        }

        // main max section
        if ( !maxResultStartPoint.equals( maxResultEndPoint ) ) {
          maxEdges.push( new LinearEdge( maxResultStartPoint, maxResultEndPoint ) );
        }

        // max-end corner
        if ( endLess && maxResultEndPoint.x !== endCornerX ) {
          maxEdges.push( new LinearEdge( maxResultEndPoint, new Vector2( endCornerX, y ) ) );
        }
      }
    }

    const minFace = new EdgedClippedFace(
      minEdges,
      face.minX, face.minY, face.maxX, y,
      face.minXCount, face.minYCount, face.maxXCount, face.maxYCount + minCount
    );
    const maxFace = new EdgedClippedFace(
      maxEdges,
      face.minX, y, face.maxX, face.maxY,
      face.minXCount, face.minYCount + maxCount, face.maxXCount, face.maxYCount
    );

    if ( assertSlow ) {
      assertSlow( Math.abs( face.getArea() - minFace.getArea() - maxFace.getArea() ) < 1e-4 );
    }

    return {
      minFace: minFace,
      maxFace: maxFace
    };
  }
}

alpenglow.register( 'BinaryClipping', BinaryClipping );