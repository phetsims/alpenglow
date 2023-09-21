// Copyright 2023, University of Colorado Boulder

/**
 * General clipping types and utilities
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */
import Vector2 from '../../../dot/js/Vector2.js';
import { alpenglow, ClipSimplifier, LinearEdge } from '../imports.js';

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

export default class PolygonClipping {

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

    PolygonClipping.binaryPushClipEdges(
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

    PolygonClipping.binaryPushClipEdges(
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

    PolygonClipping.binaryPushClipEdges(
      startPoint, endPoint,
      startCmp, endCmp,
      fakeCorner,
      intersection,
      minLinearEdges, maxLinearEdges
    );
  }

  // line where dot( normal, point ) - value = 0. "min" side is dot-products < value, "max" side is dot-products > value
  public static binaryStripeClipEdge(
    startPoint: Vector2,
    endPoint: Vector2,
    normal: Vector2, // NOTE: does NOT need to be a unit vector
    values: number[],
    fakeCornerPerpendicular: number,
    clippedEdgeCollection: LinearEdge[][] // Will append into this (for performance)
  ): void {

    const startDot = normal.dot( startPoint );
    const endDot = normal.dot( endPoint );

    const perpendicular = normal.perpendicular;

    const startPerp = perpendicular.dot( startPoint );
    const endPerp = perpendicular.dot( endPoint );
    const perpPerp = perpendicular.dot( perpendicular );
    const basePoints = values.map( value => normal.timesScalar( value / normal.dot( normal ) ) );
    const fakeCorners = basePoints.map( basePoint => perpendicular.timesScalar( fakeCornerPerpendicular ).add( basePoint ) );

    // TODO: don't recompute things twice that don't need to be computed twice (reuse, cycle)
    // TODO: ALSO can we just... jump forward instead of checking each individual one? Perhaps we can find it faster?
    for ( let j = 0; j < values.length + 1; j++ ) {
      const minValue = j > 0 ? values[ j - 1 ] : Number.NEGATIVE_INFINITY;
      const maxValue = j < values.length ? values[ j ] : Number.POSITIVE_INFINITY;

      const clippedEdges = clippedEdgeCollection[ j ];

      // Ignore lines that are completely outside of this stripe
      if (
        ( startDot < minValue && endDot < minValue ) ||
        ( startDot > maxValue && endDot > maxValue )
      ) {
        continue;
      }

      // Fully-internal case
      if ( startDot > minValue && startDot < maxValue && endDot > minValue && endDot < maxValue ) {
        clippedEdges.push( new LinearEdge( startPoint, endPoint ) );
        continue;
      }

      // if ON one of the clip lines, consider it "inside"
      if ( startDot === endDot && ( startDot === minValue || startDot === maxValue ) ) {
        clippedEdges.push( new LinearEdge( startPoint, endPoint ) );
        continue;
      }

      // TODO: don't be recomputing intersections like this
      // TODO: also don't recompute if not needed
      // TODO: we should get things from earlier

      let resultStartPoint = startPoint.copy();
      let resultEndPoint = endPoint.copy();
      let minIntersection: Vector2 | null = null;
      let maxIntersection: Vector2 | null = null;
      let startIntersection: Vector2 | null = null;
      let endIntersection: Vector2 | null = null;
      let minFakeCorner: Vector2 | null = null;
      let maxFakeCorner: Vector2 | null = null;

      if ( startDot < minValue || endDot < minValue ) {
        const value = minValue;
        const basePoint = basePoints[ j - 1 ];
        const intersectionPerp = startPerp + ( endPerp - startPerp ) * ( value - startDot ) / ( endDot - startDot );
        const intersection = perpendicular.timesScalar( intersectionPerp / perpPerp ).add( basePoint );

        minIntersection = intersection;
        if ( startDot < minValue ) {
          resultStartPoint = intersection;
          startIntersection = intersection;
        }
        if ( endDot < minValue ) {
          resultEndPoint = intersection;
          endIntersection = intersection;
        }
      }
      if ( startDot > maxValue || endDot > maxValue ) {
        const value = maxValue;
        const basePoint = basePoints[ j ];
        const intersectionPerp = startPerp + ( endPerp - startPerp ) * ( value - startDot ) / ( endDot - startDot );
        const intersection = perpendicular.timesScalar( intersectionPerp / perpPerp ).add( basePoint );

        maxIntersection = intersection;
        if ( startDot > maxValue ) {
          resultStartPoint = intersection;
          startIntersection = intersection;
        }
        if ( endDot > maxValue ) {
          resultEndPoint = intersection;
          endIntersection = intersection;
        }
      }
      if ( minIntersection ) {
        minFakeCorner = fakeCorners[ j - 1 ];
      }
      if ( maxIntersection ) {
        maxFakeCorner = fakeCorners[ j ];
      }

      // TODO: omg, test against those tricky cases, and UNIT TESTS.

      if ( startIntersection ) {
        if ( startIntersection === minIntersection && !startIntersection.equals( minFakeCorner! ) ) {
          clippedEdges.push( new LinearEdge( minFakeCorner!, resultStartPoint, true ) );
        }
        if ( startIntersection === maxIntersection && !startIntersection.equals( maxFakeCorner! ) ) {
          clippedEdges.push( new LinearEdge( maxFakeCorner!, resultStartPoint, true ) );
        }
      }

      if ( !resultStartPoint.equals( resultEndPoint ) ) {
        clippedEdges.push( new LinearEdge( resultStartPoint, resultEndPoint ) );
      }

      if ( endIntersection ) {
        if ( endIntersection === minIntersection && !endIntersection.equals( minFakeCorner! ) ) {
          clippedEdges.push( new LinearEdge( resultEndPoint, minFakeCorner!, true ) );
        }
        if ( endIntersection === maxIntersection && !endIntersection.equals( maxFakeCorner! ) ) {
          clippedEdges.push( new LinearEdge( resultEndPoint, maxFakeCorner!, true ) );
        }
      }
    }
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

  // line where dot( normal, point ) - value = 0. "min" side is dot-products < value, "max" side is dot-products > value
  public static binaryStripeClipPolygon(
    polygon: Vector2[],
    normal: Vector2, // NOTE: does NOT need to be a unit vector
    values: number[] // SHOULD BE SORTED from low to high -- no duplicates (TODO verify, enforce in gradients)
  ): Vector2[][] {
    const perpendicular = normal.perpendicular;
    const basePoints = values.map( value => normal.timesScalar( value / normal.dot( normal ) ) );
    const perpPerp = perpendicular.dot( perpendicular );

    const simplifiers = _.range( values.length + 1 ).map( () => new ClipSimplifier() );

    // TODO: export the bounds of each polygon (ignoring the fake corners)?
    // TODO: this is helpful, since currently we'll need to rasterize the "full" bounds?

    for ( let i = 0; i < polygon.length; i++ ) {
      const startPoint = polygon[ i ];
      const endPoint = polygon[ ( i + 1 ) % polygon.length ];

      const startDot = normal.dot( startPoint );
      const endDot = normal.dot( endPoint );

      for ( let j = 0; j < simplifiers.length; j++ ) {
        const simplifier = simplifiers[ j ];
        const minValue = j > 0 ? values[ j - 1 ] : Number.NEGATIVE_INFINITY;
        const maxValue = j < values.length ? values[ j ] : Number.POSITIVE_INFINITY;

        // Ignore lines that are completely outside of this stripe
        if (
          ( startDot < minValue && endDot < minValue ) ||
          ( startDot > maxValue && endDot > maxValue )
        ) {
          continue;
        }

        // Fully-internal case
        if ( startDot > minValue && startDot < maxValue && endDot > minValue && endDot < maxValue ) {
          simplifier.add( startPoint.x, startPoint.y );
          continue;
        }

        // if ON one of the clip lines, consider it "inside"
        if ( startDot === endDot && ( startDot === minValue || startDot === maxValue ) ) {
          simplifier.add( startPoint.x, startPoint.y );
          continue;
        }

        const startPerp = perpendicular.dot( startPoint );
        const endPerp = perpendicular.dot( endPoint );

        // TODO: don't be recomputing intersections like this
        // TODO: also don't recompute if not needed
        // TODO: we should get things from earlier
        if ( startDot <= minValue ) {
          const minIntersectionPerp = startPerp + ( endPerp - startPerp ) * ( minValue - startDot ) / ( endDot - startDot );
          const minIntersection = perpendicular.timesScalar( minIntersectionPerp / perpPerp ).add( basePoints[ j - 1 ] );
          simplifier.add( minIntersection.x, minIntersection.y );
        }
        else if ( startDot >= maxValue ) {
          const maxIntersectionPerp = startPerp + ( endPerp - startPerp ) * ( maxValue - startDot ) / ( endDot - startDot );
          const maxIntersection = perpendicular.timesScalar( maxIntersectionPerp / perpPerp ).add( basePoints[ j ] );
          simplifier.add( maxIntersection.x, maxIntersection.y );
        }
        else {
          simplifier.add( startPoint.x, startPoint.y );
        }

        if ( endDot <= minValue ) {
          const minIntersectionPerp = startPerp + ( endPerp - startPerp ) * ( minValue - startDot ) / ( endDot - startDot );
          const minIntersection = perpendicular.timesScalar( minIntersectionPerp / perpPerp ).add( basePoints[ j - 1 ] );
          simplifier.add( minIntersection.x, minIntersection.y );
        }
        else if ( endDot >= maxValue ) {
          const maxIntersectionPerp = startPerp + ( endPerp - startPerp ) * ( maxValue - startDot ) / ( endDot - startDot );
          const maxIntersection = perpendicular.timesScalar( maxIntersectionPerp / perpPerp ).add( basePoints[ j ] );
          simplifier.add( maxIntersection.x, maxIntersection.y );
        }
        else {
          simplifier.add( endPoint.x, endPoint.y );
        }
      }
    }

    return simplifiers.map( simplifier => simplifier.finalize() );
  }
}

alpenglow.register( 'PolygonClipping', PolygonClipping );
