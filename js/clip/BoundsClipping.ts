// Copyright 2023, University of Colorado Boulder

/**
 * Clipping arbitrary (degenerate, non-convex, self-intersecting, etc.) polygons to within an axis-aligned bounding box
 *
 * This uses a somewhat home-brew algorithm that conceptually will work for both polygonal (sorted) and edge-based
 * (unsorted) inputs, so that computations can be done in parallel and on unsorted edges if helpful.
 *
 * They work by taking each "exterior" section of edge and mapping the endpoints to the closest corners (with a possible
 * third corner in-between).
 *
 *                         C
 *                        x
 *                       x
 *        closest       x
 *      corner to C    x
 *            ┌───────2──────────────────────────┐
 *            │3cccccx                           │
 *            │    bx                            │
 *            │   bx                             │
 *            │  bx       x: the input line      │
 *            │ bx        A: start vertex        │
 *            │bx         C: end vertex          │
 *            │x          1: clipped start vertex│
 *            1a          2: clipped end vertex  │
 *           x│a                                 │
 *          x │a    The line from A to C will    │
 *         x  │a    generate three edges:        │
 *        x   │a                                 │
 *       x    │a   a - 0 to 1 (from corner)      │
 *      x     │a   b - 1 to 2 (clipped inside)   │
 *     A      │a   c - 2 to 3 (to corner)        │
 *            │a                                 │
 *            │0                                 │
 *            └──────────────────────────────────┘
 *        closest
 *       corner to A
 *
 *
 *
 *                          B
 *                        xx
 *                      xx
 *                    xx
 *                  xxx
 *                xx
 *              xx
 *            xx 1──────2
 *          xx   │      │
 *        xx     │      │
 *      xx       │      │
 *     A         0──────┘
 *
 * In the above case, the line from A to B will generate two edges, (0 to 1, 1 to 2), and is the case where we need to
 * disambiguate between the two possible middle corners, since it is going opposite-to-opposite.
 *
 * For these cases to work, it's important for the points of a polygon to be precise (so edges match up perfectly
 * flush), since we will conditionally generate the "to-corner" edges based on whether the start/end points are
 * on the border or outside.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */
import Vector2 from '../../../dot/js/Vector2.js';
import { alpenglow, ClipSimplifier, LinearEdge, LineClipping } from '../imports.js';

// TODO: parallelize this (should be possible)

const scratchStartPoint = new Vector2( 0, 0 );
const scratchEndPoint = new Vector2( 0, 0 );
const simplifier = new ClipSimplifier();

export default class BoundsClipping {
  /**
   * Clips a single edge to the inside of the given bounding box, and appends the resulting edges to the result array.
   *
   * For efficiency, the center point of the bounding box should also be provided.
   *
   * @param startPoint - Starting point of the input edge
   * @param endPoint - Ending point of the input edge
   * @param minX - Minimum x of the bounding box
   * @param minY - Minimum y of the bounding box
   * @param maxX - Maximum x of the bounding box
   * @param maxY - Maximum y of the bounding box
   * @param centerX - Center x of the bounding box
   * @param centerY - Center y of the bounding box
   * @param [result] - The array that we'll append the output edges to
   */
  public static boundsClipEdge(
    startPoint: Vector2, endPoint: Vector2,
    minX: number, minY: number, maxX: number, maxY: number, centerX: number, centerY: number,
    result: LinearEdge[] = []
  ): LinearEdge[] {

    const clippedStartPoint = scratchStartPoint.set( startPoint );
    const clippedEndPoint = scratchEndPoint.set( endPoint );

    const clipped = LineClipping.matthesDrakopoulosClip( clippedStartPoint, clippedEndPoint, minX, minY, maxX, maxY );

    let startXLess;
    let startYLess;
    let endXLess;
    let endYLess;

    const needsStartCorner = !clipped || !startPoint.equals( clippedStartPoint );
    const needsEndCorner = !clipped || !endPoint.equals( clippedEndPoint );
    let startCorner: Vector2;
    let endCorner: Vector2;

    if ( needsStartCorner ) {
      startXLess = startPoint.x < centerX;
      startYLess = startPoint.y < centerY;
      startCorner = new Vector2(
        startXLess ? minX : maxX,
        startYLess ? minY : maxY
      );
    }
    if ( needsEndCorner ) {
      endXLess = endPoint.x < centerX;
      endYLess = endPoint.y < centerY;
      endCorner = new Vector2(
        endXLess ? minX : maxX,
        endYLess ? minY : maxY
      );
    }

    if ( clipped ) {
      const resultStartPoint = clippedStartPoint.copy();
      const resultEndPoint = clippedEndPoint.copy();

      if ( needsStartCorner && !startCorner!.equals( resultStartPoint ) ) {
        assert && assert( startCorner! );

        result.push( new LinearEdge( startCorner!, resultStartPoint ) );
      }

      if ( !resultStartPoint.equals( resultEndPoint ) ) {
        result.push( new LinearEdge( resultStartPoint, resultEndPoint ) );
      }

      if ( needsEndCorner && !endCorner!.equals( resultEndPoint ) ) {
        assert && assert( endCorner! );

        result.push( new LinearEdge( resultEndPoint, endCorner! ) );
      }
    }
    else {
      assert && assert( startCorner! && endCorner! );

      if ( startXLess !== endXLess && startYLess !== endYLess ) {
        // we crossed from one corner to the opposite, but didn't hit. figure out which corner we passed
        // we're diagonal, so solving for y=centerY should give us the info we need
        const y = startPoint.y + ( endPoint.y - startPoint.y ) * ( centerX - startPoint.x ) / ( endPoint.x - startPoint.x );

        // Based on whether we are +x+y => -x-y or -x+y => +x-y
        const startSame = startXLess === startYLess;
        const yGreater = y > centerY;

        const middlePoint = new Vector2(
          startSame === yGreater ? minX : maxX,
          yGreater ? maxY : minY
        );

        result.push( new LinearEdge( startCorner!, middlePoint ) );
        result.push( new LinearEdge( middlePoint, endCorner! ) );
      }
      else if ( !startCorner!.equals( endCorner! ) ) {
        result.push( new LinearEdge( startCorner!, endCorner! ) );
      }
    }

    return result;
  }

  /**
   * Clips a single polygon to the inside of the given bounding box, returning the resulting points of the polygon.
   *
   * For efficiency, the center point of the bounding box should also be provided.
   *
   * @param polygon - The input polygon
   * @param minX - Minimum x of the bounding box
   * @param minY - Minimum y of the bounding box
   * @param maxX - Maximum x of the bounding box
   * @param maxY - Maximum y of the bounding box
   * @param centerX - Center x of the bounding box
   * @param centerY - Center y of the bounding box
   */
  public static boundsClipPolygon(
    polygon: Vector2[],
    minX: number, minY: number, maxX: number, maxY: number, centerX: number, centerY: number
  ): Vector2[] {

    // TODO: don't provide so many points to the simplifier? Can we cut down those function calls?

    for ( let i = 0; i < polygon.length; i++ ) {
      // TODO: if relevant, we can minimize the number of array accesses here by storing the previous point
      const startPoint = polygon[ i ];
      const endPoint = polygon[ ( i + 1 ) % polygon.length ];

      const clippedStartPoint = scratchStartPoint.set( startPoint );
      const clippedEndPoint = scratchEndPoint.set( endPoint );

      const clipped = LineClipping.matthesDrakopoulosClip( clippedStartPoint, clippedEndPoint, minX, minY, maxX, maxY );

      let startXLess;
      let startYLess;
      let endXLess;
      let endYLess;

      const needsStartCorner = !clipped || !startPoint.equals( clippedStartPoint );
      const needsEndCorner = !clipped || !endPoint.equals( clippedEndPoint );

      if ( needsStartCorner ) {
        startXLess = startPoint.x < centerX;
        startYLess = startPoint.y < centerY;
      }
      if ( needsEndCorner ) {
        endXLess = endPoint.x < centerX;
        endYLess = endPoint.y < centerY;
      }

      if ( needsStartCorner ) {
        simplifier.add(
          startXLess ? minX : maxX,
          startYLess ? minY : maxY
        );
      }
      if ( clipped ) {
        simplifier.add( clippedStartPoint.x, clippedStartPoint.y );
        simplifier.add( clippedEndPoint.x, clippedEndPoint.y );
      }
      else {
        if ( startXLess !== endXLess && startYLess !== endYLess ) {
          // we crossed from one corner to the opposite, but didn't hit. figure out which corner we passed
          // we're diagonal, so solving for y=centerY should give us the info we need
          const y = startPoint.y + ( endPoint.y - startPoint.y ) * ( centerX - startPoint.x ) / ( endPoint.x - startPoint.x );

          // Based on whether we are +x+y => -x-y or -x+y => +x-y
          const startSame = startXLess === startYLess;
          const yGreater = y > centerY;
          simplifier.add(
            startSame === yGreater ? minX : maxX,
            yGreater ? maxY : minY
          );
        }
      }
      if ( needsEndCorner ) {
        simplifier.add(
          endXLess ? minX : maxX,
          endYLess ? minY : maxY
        );
      }
    }

    return simplifier.finalize();
  }
}

alpenglow.register( 'BoundsClipping', BoundsClipping );
