// Copyright 2023, University of Colorado Boulder

/**
 * An interface for clippable/subdivide-able faces, with defined bounds and area.
 *
 * NOTE: "fake" corners are needed for some clipping operations (notably the binary line clipping operations, without
 * bounds). These are corners that are not actually part of the face, but are used when we don't have access to the
 * entire polygon, and need to output edges which will match up with other results. In these cases, we might generate
 * edges that go OUTSIDE of the resulting bounds, so if we need to access bounds of the ClippableFace, we'll need to
 * ignore these "fake" corners.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import Bounds2 from '../../../dot/js/Bounds2.js';
import Range from '../../../dot/js/Range.js';
import Vector2 from '../../../dot/js/Vector2.js';
import Matrix3 from '../../../dot/js/Matrix3.js';
import IntentionalAny from '../../../phet-core/js/types/IntentionalAny.js';
import { EdgedClippedFace, EdgedFace, GridClipCallback, PolygonalFace, PolygonCompleteCallback, SerializedEdgedFace, SerializedPolygonalFace } from '../imports.js';
import { Shape } from '../../../kite/js/imports.js';

// TODO: assertions that all types of ClippableFace give the same results for the same methods

type ClippableFace = {
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

export default ClippableFace;

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
  // We are not checking the given type! We're wrapping these
  // eslint-disable-next-line no-simple-type-checking-assertions
  assert && assert( clippableFace instanceof PolygonalFace || clippableFace instanceof EdgedFace );

  return {
    type: clippableFace instanceof PolygonalFace ? 'PolygonalFace' : 'EdgedFace',
    face: clippableFace.serialize()
  };
};

export const deserializeClippableFace = ( serialized: SerializedClippableFace ): ClippableFace => {
  return serialized.type === 'PolygonalFace' ? PolygonalFace.deserialize( serialized.face ) : EdgedFace.deserialize( serialized.face );
};
