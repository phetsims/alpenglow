// Copyright 2023, University of Colorado Boulder

/**
 * Clipping arbitrary (degenerate, non-convex, self-intersecting, etc.) polygons to the inside/outside of a circle.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */
import Vector2 from '../../../dot/js/Vector2.js';
import { alpenglow, BinaryClipCallback, BinaryPolygonCompleteCallback, ClipSimplifier, LinearEdge, PolygonalFace } from '../imports.js';
import Utils from '../../../dot/js/Utils.js';

const simplifier = new ClipSimplifier();

export default class CircularClipping {

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

      const roots = Utils.solveQuadraticRootsReal( a, b, c );

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

        const roots = Utils.solveQuadraticRootsReal( a, b, c );

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

        const roots = Utils.solveQuadraticRootsReal( a, b, c );

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
