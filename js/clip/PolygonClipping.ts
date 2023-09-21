// Copyright 2023, University of Colorado Boulder

/**
 * General clipping types and utilities
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */
import Vector2 from '../../../dot/js/Vector2.js';
import { alpenglow, ClipSimplifier, LinearEdge, LineClipping } from '../imports.js';
import Utils from '../../../dot/js/Utils.js';

// TODO: parallelize this (should be possible)

const scratchStartPoint = new Vector2( 0, 0 );
const scratchEndPoint = new Vector2( 0, 0 );
const minSimplifier = new ClipSimplifier();
const maxSimplifier = new ClipSimplifier();
const xIntercepts: number[] = [];
const yIntercepts: number[] = [];

export type GridClipCallback = (
  cellX: number,
  cellY: number,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  startPoint: Vector2 | null,
  endPoint: Vector2 | null
) => void;

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

  // TODO: See if we can get the intercepts to work, since it WOULD be higher performance. Can we perturb the
  // TODO: intercepts to values that will be acceptable?
  // @deprecated
  public static gridClipInterceptIterate(
    startPoint: Vector2,
    endPoint: Vector2,
    minX: number, minY: number, maxX: number, maxY: number,
    stepX: number, stepY: number, stepWidth: number, stepHeight: number,
    callback: GridClipCallback
  ): void {
    assertSlow && assertSlow( startPoint.isFinite() );
    assertSlow && assertSlow( endPoint.isFinite() );
    assertSlow && assertSlow( isFinite( minX ) && Number.isInteger( minX ) );
    assertSlow && assertSlow( isFinite( minY ) && Number.isInteger( minY ) );
    assertSlow && assertSlow( isFinite( maxX ) && Number.isInteger( maxX ) );
    assertSlow && assertSlow( isFinite( maxY ) && Number.isInteger( maxY ) );
    assertSlow && assertSlow( startPoint.x >= minX && startPoint.x <= maxX && startPoint.y >= minY && startPoint.y <= maxY );
    assertSlow && assertSlow( endPoint.x >= minX && endPoint.x <= maxX && endPoint.y >= minY && endPoint.y <= maxY );
    assertSlow && assertSlow( isFinite( stepX ) && Number.isInteger( stepX ) );
    assertSlow && assertSlow( isFinite( stepY ) && Number.isInteger( stepY ) );
    assertSlow && assertSlow( stepWidth % 1 === 0 && stepWidth > 0 );
    assertSlow && assertSlow( stepHeight % 1 === 0 && stepHeight > 0 );
    assertSlow && assertSlow( stepWidth === ( maxX - minX ) / stepX );
    assertSlow && assertSlow( stepHeight === ( maxY - minY ) / stepY );

    // TODO: in the caller, assertSlow total area is the same!
    // TODO: have clients deduplicate points if needed (might output zero-length things)

    // If there is just a single cell, it's essentially a no-op clip-wise. Just pass in the edge to it.
    if ( stepWidth === 1 && stepHeight === 1 ) {
      callback(
        0, 0,
        startPoint.x, startPoint.y,
        endPoint.x, endPoint.y,
        startPoint, endPoint
      );
      return;
    }

    // TODO: get rid of these functions (inline)
    const toStepX = ( x: number ) => ( x - minX ) / stepX;
    const toStepY = ( y: number ) => ( y - minY ) / stepY;
    const fromStepX = ( x: number ) => x * stepX + minX;
    const fromStepY = ( y: number ) => y * stepY + minY;

    // TODO: optimize below here

    // Some general-use booleans we'll use at various points
    const startXLess = startPoint.x < endPoint.x;
    const startYLess = startPoint.y < endPoint.y;
    const isHorizontal = startPoint.y === endPoint.y;
    const isVertical = startPoint.x === endPoint.x;

    // In "step" coordinates, in the ranges [0,stepWidth], [0,stepHeight]. "raw" indicates "potentially fractional"
    const rawStartStepX = toStepX( startPoint.x );
    const rawStartStepY = toStepY( startPoint.y );
    const rawEndStepX = toStepX( endPoint.x );
    const rawEndStepY = toStepY( endPoint.y );

    const minRawStartStepX = Math.min( rawStartStepX, rawEndStepX );
    const minRawStartStepY = Math.min( rawStartStepY, rawEndStepY );
    const maxRawStartStepX = Math.max( rawStartStepX, rawEndStepX );
    const maxRawStartStepY = Math.max( rawStartStepY, rawEndStepY );

    const roundedMinStepX = Utils.roundSymmetric( minRawStartStepX );
    const roundedMinStepY = Utils.roundSymmetric( minRawStartStepY );
    const roundedMaxStepX = Utils.roundSymmetric( maxRawStartStepX );
    const roundedMaxStepY = Utils.roundSymmetric( maxRawStartStepY );

    // Integral "step" coordinates - with slight perturbation to expand our region to cover points/lines that lie
    // exactly on our grid lines (but not outside of our bounds)
    const minStepX = Math.max( 0, Math.floor( minRawStartStepX - 1e-10 ) );
    const minStepY = Math.max( 0, Math.floor( minRawStartStepY - 1e-10 ) );
    const maxStepX = Math.min( stepWidth, Math.ceil( maxRawStartStepX + 1e-10 ) );
    const maxStepY = Math.min( stepHeight, Math.ceil( maxRawStartStepY + 1e-10 ) );

    const lineStepWidth = maxStepX - minStepX;
    const lineStepHeight = maxStepY - minStepY;

    // We'll ignore intercepts of the specific direction when horizontal/vertical. These will be skipped later.
    if ( lineStepWidth > 1 && !isVertical ) {
      const firstY = startPoint.y + ( endPoint.y - startPoint.y ) * ( fromStepX( minStepX + 1 ) - startPoint.x ) / ( endPoint.x - startPoint.x );
      assert && assert( isFinite( firstY ) );
      yIntercepts.push( firstY );

      if ( lineStepWidth > 2 ) {
        const slopeIncrement = stepX * ( endPoint.y - startPoint.y ) / ( endPoint.x - startPoint.x );
        let y = firstY;
        for ( let j = minStepX + 2; j < maxStepX; j++ ) {
          y += slopeIncrement;

          // NOTE: We'll any intercept that matches a start/end point to match up exactly (we're working around
          // floating point error here)
          const x = fromStepX( j );
          if ( x === startPoint.x ) {
            assert && assert( Math.abs( y - startPoint.y ) < 1e-7 );
            y = startPoint.y;
          }
          if ( x === endPoint.x ) {
            assert && assert( Math.abs( y - endPoint.y ) < 1e-7 );
            y = endPoint.y;
          }

          assert && assert( isFinite( y ) );
          yIntercepts.push( y );
        }
      }
    }
    if ( lineStepHeight > 1 && !isHorizontal ) {
      const firstX = startPoint.x + ( endPoint.x - startPoint.x ) * ( fromStepY( minStepY + 1 ) - startPoint.y ) / ( endPoint.y - startPoint.y );
      assert && assert( isFinite( firstX ) );
      xIntercepts.push( firstX );

      if ( lineStepHeight > 2 ) {
        const slopeIncrement = stepY * ( endPoint.x - startPoint.x ) / ( endPoint.y - startPoint.y );
        let x = firstX;
        for ( let j = minStepY + 2; j < maxStepY; j++ ) {
          x += slopeIncrement;

          // NOTE: We'll any intercept that matches a start/end point to match up exactly (we're working around
          // floating point error here)
          const y = fromStepY( j );
          if ( y === startPoint.y ) {
            assert && assert( Math.abs( x - startPoint.x ) < 1e-7 );
            x = startPoint.x;
          }
          if ( y === endPoint.y ) {
            assert && assert( Math.abs( x - endPoint.x ) < 1e-7 );
            x = endPoint.x;
          }

          assert && assert( isFinite( x ) );
          xIntercepts.push( x );
        }
      }
    }

    // xxxx is the line segment (edge)
    // | and - notes the "clipped along cell bounds" sections
    //
    // minX  minStepX                   maxStepX        maxX
    //   ┌──────┬──────┬──────┬──────┬──────┬──────┬──────┐maxY
    //   │      │  x   │  x   │  x   │  x   │      │      │
    //   │  no  │ past │intern│intern│ not  │  no  │  no  │
    //   │effect│ half │      │      │ past │effect│effect│
    //   │corner│------│------│------│ half │corner│corner│
    //   ├──────┼──────┼──────┼──────┴──────┼──────┼──────┤maxStepY
    //   │  y  |│     |│     |│     |xx     │| y   │| y   │
    //   │ past|│     |│     |│    xx│|     │|past │|past │
    //   │ half|│     |│     |│  xx  │|     │|half │|half │
    //   │     |│------│------│xx    │|     │|     │|     │
    //   ├──────┼──────┼─────xx──────┼──────┼──────┼──────┤
    //   │  y  |│     |│   xx │------│|     │| y   │| y   │
    //   │inter|│     |│ xx   │|     │|     │|ntern│|ntern│
    //   │     |│      xx     │|     │|     │|     │|     │
    //   │     |│----xx│|     │|     │|     │|     │|     │
    //   ├──────┼──xx──┼──────┼──────┼──────┼──────┼──────┤
    //   │  y   │xx----│------│------│      │  y   │  y   │
    //   │ not  x      │      │      │      │ not  │ not  │
    //   │ past │      │      │      │      │ past │ past │
    //   │ half │      │      │      │      │ half │ half │
    //   ├──────┼──────┼──────┼──────┼──────┼──────┼──────┤minStepY
    //   │      │------│------│------│  x   │      │      │
    //   │  no  │  x   │      │      │ not  │  no  │  no  │
    //   │effect│ past │  x   │  x   │ past │effect│effect│
    //   │corner│ half │intern│intern│ half │corner│corner│
    //   └──────┴──────┴──────┴──────┴──────┴──────┴──────┘minY

    // Handle "internal" cases (the step rectangle that overlaps the line)
    if ( lineStepWidth === 1 && lineStepHeight === 1 ) {
      // If we only take up one cell, we can do a much more optimized form (AND in the future hopefully the clip
      // simplifier will be able to pass through vertices without GC

      callback(
        minStepX, minStepY,
        startPoint.x, startPoint.y,
        endPoint.x, endPoint.y,
        startPoint, endPoint
      );
    }
    else {
      // Do the "internal" grid
      for ( let iy = minStepY; iy < maxStepY; iy++ ) {
        // TODO: this could be optimized
        const cellMinY = fromStepY( iy );
        const cellMaxY = fromStepY( iy + 1 );
        const cellCenterY = ( cellMinY + cellMaxY ) / 2;

        const isFirstY = iy === minStepY;
        const isLastY = iy === maxStepY - 1;

        // The x intercepts for the minimal-y and maximal-y sides of the cell (or if we're on the first or last y cell, the endpoint)
        const minYXIntercept = isFirstY || isHorizontal ? ( startYLess ? startPoint.x : endPoint.x ) : xIntercepts[ iy - minStepY - 1 ];
        const maxYXIntercept = isLastY || isHorizontal ? ( startYLess ? endPoint.x : startPoint.x ) : xIntercepts[ iy - minStepY ];

        // Our range of intercepts (so we can quickly check in the inner iteration)
        const minXIntercept = Math.min( minYXIntercept, maxYXIntercept );
        const maxXIntercept = Math.max( minYXIntercept, maxYXIntercept );

        for ( let ix = minStepX; ix < maxStepX; ix++ ) {
          const cellMinX = fromStepX( ix );
          const cellMaxX = fromStepX( ix + 1 );
          const cellCenterX = ( cellMinX + cellMaxX ) / 2;

          const isFirstX = ix === minStepX;
          const isLastX = ix === maxStepX - 1;

          const minXYIntercept = isFirstX || isVertical ? ( startXLess ? startPoint.y : endPoint.y ) : yIntercepts[ ix - minStepX - 1 ];
          const maxXYIntercept = isLastX || isVertical ? ( startXLess ? endPoint.y : startPoint.y ) : yIntercepts[ ix - minStepX ];
          const minYIntercept = Math.min( minXYIntercept, maxXYIntercept );
          const maxYIntercept = Math.max( minXYIntercept, maxXYIntercept );

          // NOTE: If we have horizontal/vertical lines, we'll need to change our logic slightly here
          const isLessThanMinX = isVertical ? cellMaxX < minXIntercept : cellMaxX <= minXIntercept;
          const isGreaterThanMaxX = isVertical ? cellMinX > maxXIntercept : cellMinX >= maxXIntercept;
          const isLessThanMinY = isHorizontal ? cellMaxY < minYIntercept : cellMaxY <= minYIntercept;
          const isGreaterThanMaxY = isHorizontal ? cellMinY > maxYIntercept : cellMinY >= maxYIntercept;

          // If this condition is true, the line does NOT pass through this cell. We just have to handle the corners.
          // NOTE: We're conditioning it on BOTH of these. Our intercept computations introduce floating point
          // error, which can cause issues if only one of these is true (we'll get the precise bits wrong).
          if ( ( isLessThanMinX || isGreaterThanMaxX ) && ( isLessThanMinY || isGreaterThanMaxY ) ) {
            // Since we are just handling corners, we can potentially have a horizontal edge and/or a vertical edge.
            // (NOTE: none, both, or one of these can be true).

            const isOnEndX = isFirstX || isLastX;
            const isOnEndY = isFirstY || isLastY;

            // If we're fully "internal", we'll have the spanning edge. If not, we'll need to check to see how we
            // compare to the center of the cell (remember, we are picking the closest corners to the start and end
            // of the line, so for us to have an edge here, the start/end have to be closer to different corners.
            // We've stored the rounded step coordinates, so we can just check against those.
            const hasHorizontal = isOnEndX ? ix >= roundedMinStepX && ( ix + 1 ) <= roundedMaxStepX : true;
            const hasVertical = isOnEndY ? iy >= roundedMinStepY && ( iy + 1 ) <= roundedMaxStepY : true;

            if ( hasHorizontal && hasVertical ) {
              // NOTE: This logic is based on examining the 8 cases we can have of "directed line segments that
              // pass by our cell without going through it". Basically, since we are guaranteed that both of the
              // x-intercepts are to the right OR left of the cell (in the same direction), and similarly for the
              // y-intercepts, that gives us 4 cases. For each of those, the line could be moving from one end to the
              // other (resulting in 8 cases).

              // If we have both, we will have a shared corner
              const cornerX = isLessThanMinX ? cellMaxX : cellMinX;
              const cornerY = isLessThanMinY ? cellMaxY : cellMinY;

              // There will also be two other points, one horizontally and one vertically offset from the corner
              const otherX = isLessThanMinX ? cellMinX : cellMaxX;
              const otherY = isLessThanMinY ? cellMinY : cellMaxY;

              // Compute whether we need to add the horizontal or vertical first.
              const xFirst = isLessThanMinX ? startXLess : !startXLess;

              callback(
                ix, iy,
                xFirst ? otherX : cornerX, xFirst ? cornerY : otherY,
                cornerX, cornerY,
                null, null
              );
              callback(
                ix, iy,
                cornerX, cornerY,
                xFirst ? cornerX : otherX, xFirst ? otherY : cornerY,
                null, null
              );
            }
            else if ( hasHorizontal ) {
              const y = isLessThanMinY ? cellMaxY : cellMinY;
              callback(
                ix, iy,
                startXLess ? cellMinX : cellMaxX, y,
                startXLess ? cellMaxX : cellMinX, y,
                null, null
              );
            }
            else if ( hasVertical ) {
              const x = isLessThanMinX ? cellMaxX : cellMinX;
              callback(
                ix, iy,
                x, startYLess ? cellMinY : cellMaxY,
                x, startYLess ? cellMaxY : cellMinY,
                null, null
              );
            }
          }
          else {
            // We go through the cell! Additionally due to previous filtering, we are pretty much guaranteed to touch
            // a cell side.

            const minYX = Utils.clamp( minYXIntercept, cellMinX, cellMaxX );
            const maxYX = Utils.clamp( maxYXIntercept, cellMinX, cellMaxX );
            const minXY = Utils.clamp( minXYIntercept, cellMinY, cellMaxY );
            const maxXY = Utils.clamp( maxXYIntercept, cellMinY, cellMaxY );

            let startX;
            let startY;
            let endX;
            let endY;

            if ( isHorizontal ) {
              const minX = Math.min( minYX, maxYX );
              const maxX = Math.max( minYX, maxYX );

              startX = startXLess ? minX : maxX;
              endX = startXLess ? maxX : minX;
            }
            else {
              startX = startYLess ? minYX : maxYX;
              endX = startYLess ? maxYX : minYX;
            }

            if ( isVertical ) {
              const minY = Math.min( minXY, maxXY );
              const maxY = Math.max( minXY, maxXY );

              startY = startYLess ? minY : maxY;
              endY = startYLess ? maxY : minY;
            }
            else {
              startY = startXLess ? minXY : maxXY;
              endY = startXLess ? maxXY : minXY;
            }

            // Ensure we have the correct direction (and our logic is correct)
            assertSlow && assertSlow(
              ( Math.abs( endX - startX ) < 1e-8 && Math.abs( endY - startY ) < 1e-8 ) ||
              new Vector2( endX - startX, endY - startY ).normalized()
                .equalsEpsilon( endPoint.minus( startPoint ).normalized(), 1e-5 ) );

            const needsStartCorner = startX !== startPoint.x || startY !== startPoint.y;
            const needsEndCorner = endX !== endPoint.x || endY !== endPoint.y;

            const existingStartPoint = needsStartCorner ? null : startPoint;
            const existingEndPoint = needsEndCorner ? null : endPoint;

            if ( needsStartCorner ) {
              callback(
                ix, iy,
                startPoint.x < cellCenterX ? cellMinX : cellMaxX, startPoint.y < cellCenterY ? cellMinY : cellMaxY,
                startX, startY,
                null, existingStartPoint
              );
            }
            callback(
              ix, iy,
              startX, startY,
              endX, endY,
              existingStartPoint, existingEndPoint
            );
            if ( needsEndCorner ) {
              callback(
                ix, iy,
                endX, endY,
                endPoint.x < cellCenterX ? cellMinX : cellMaxX, endPoint.y < cellCenterY ? cellMinY : cellMaxY,
                existingEndPoint, null
              );
            }
          }
        }
      }
    }

    // x internal, y external
    for ( let ix = roundedMinStepX; ix < roundedMaxStepX; ix++ ) {
      const x0 = fromStepX( ix );
      const x1 = fromStepX( ix + 1 );

      // min-y side
      for ( let iy = 0; iy < minStepY; iy++ ) {
        const y = fromStepY( iy + 1 );
        callback(
          ix, iy,
          startXLess ? x0 : x1, y,
          startXLess ? x1 : x0, y,
          null, null
        );
      }
      // max-y side
      for ( let iy = maxStepY; iy < stepHeight; iy++ ) {
        const y = fromStepY( iy );
        callback(
          ix, iy,
          startXLess ? x0 : x1, y,
          startXLess ? x1 : x0, y,
          null, null
        );
      }
    }

    // y internal, x external
    for ( let iy = roundedMinStepY; iy < roundedMaxStepY; iy++ ) {
      const y0 = fromStepY( iy );
      const y1 = fromStepY( iy + 1 );

      // min-x side
      for ( let ix = 0; ix < minStepX; ix++ ) {
        const x = fromStepX( ix + 1 );
        callback(
          ix, iy,
          x, startYLess ? y0 : y1,
          x, startYLess ? y1 : y0,
          null, null
        );
      }
      // max-x side
      for ( let ix = maxStepX; ix < stepWidth; ix++ ) {
        const x = fromStepX( ix );
        callback(
          ix, iy,
          x, startYLess ? y0 : y1,
          x, startYLess ? y1 : y0,
          null, null
        );
      }
    }

    xIntercepts.length = 0;
    yIntercepts.length = 0;
  }

  public static gridClipIterate(
    startPoint: Vector2,
    endPoint: Vector2,
    minX: number, minY: number, maxX: number, maxY: number,
    stepX: number, stepY: number, stepWidth: number, stepHeight: number,
    callback: GridClipCallback
  ): void {
    assertSlow && assertSlow( startPoint.isFinite() );
    assertSlow && assertSlow( endPoint.isFinite() );
    assertSlow && assertSlow( isFinite( minX ) && Number.isInteger( minX ) );
    assertSlow && assertSlow( isFinite( minY ) && Number.isInteger( minY ) );
    assertSlow && assertSlow( isFinite( maxX ) && Number.isInteger( maxX ) );
    assertSlow && assertSlow( isFinite( maxY ) && Number.isInteger( maxY ) );
    assertSlow && assertSlow( startPoint.x >= minX && startPoint.x <= maxX && startPoint.y >= minY && startPoint.y <= maxY );
    assertSlow && assertSlow( endPoint.x >= minX && endPoint.x <= maxX && endPoint.y >= minY && endPoint.y <= maxY );
    assertSlow && assertSlow( isFinite( stepX ) && Number.isInteger( stepX ) );
    assertSlow && assertSlow( isFinite( stepY ) && Number.isInteger( stepY ) );
    assertSlow && assertSlow( stepWidth % 1 === 0 && stepWidth > 0 );
    assertSlow && assertSlow( stepHeight % 1 === 0 && stepHeight > 0 );
    assertSlow && assertSlow( stepWidth === ( maxX - minX ) / stepX );
    assertSlow && assertSlow( stepHeight === ( maxY - minY ) / stepY );

    // TODO: in the caller, assertSlow total area is the same!
    // TODO: have clients deduplicate points if needed (might output zero-length things)

    // Handle the trivial case early
    if ( startPoint.x === endPoint.x && startPoint.y === endPoint.y ) {
      return;
    }

    // If there is just a single cell, it's essentially a no-op clip-wise. Just pass in the edge to it.
    if ( stepWidth === 1 && stepHeight === 1 ) {
      callback(
        0, 0,
        startPoint.x, startPoint.y,
        endPoint.x, endPoint.y,
        startPoint, endPoint
      );
      return;
    }

    // TODO: get rid of these functions (inline)
    const toStepX = ( x: number ) => ( x - minX ) / stepX;
    const toStepY = ( y: number ) => ( y - minY ) / stepY;
    const fromStepX = ( x: number ) => x * stepX + minX;
    const fromStepY = ( y: number ) => y * stepY + minY;

    // TODO: optimize below here

    // Some general-use booleans we'll use at various points
    const startXLess = startPoint.x < endPoint.x;
    const startYLess = startPoint.y < endPoint.y;
    const isHorizontal = startPoint.y === endPoint.y;
    const isVertical = startPoint.x === endPoint.x;

    // In "step" coordinates, in the ranges [0,stepWidth], [0,stepHeight]. "raw" indicates "potentially fractional"
    const rawStartStepX = toStepX( startPoint.x );
    const rawStartStepY = toStepY( startPoint.y );
    const rawEndStepX = toStepX( endPoint.x );
    const rawEndStepY = toStepY( endPoint.y );

    const minRawStartStepX = Math.min( rawStartStepX, rawEndStepX );
    const minRawStartStepY = Math.min( rawStartStepY, rawEndStepY );
    const maxRawStartStepX = Math.max( rawStartStepX, rawEndStepX );
    const maxRawStartStepY = Math.max( rawStartStepY, rawEndStepY );

    const roundedMinStepX = Utils.roundSymmetric( minRawStartStepX );
    const roundedMinStepY = Utils.roundSymmetric( minRawStartStepY );
    const roundedMaxStepX = Utils.roundSymmetric( maxRawStartStepX );
    const roundedMaxStepY = Utils.roundSymmetric( maxRawStartStepY );

    // Integral "step" coordinates - with slight perturbation to expand our region to cover points/lines that lie
    // exactly on our grid lines (but not outside of our bounds)
    const minStepX = Math.max( 0, Math.floor( minRawStartStepX - 1e-10 ) );
    const minStepY = Math.max( 0, Math.floor( minRawStartStepY - 1e-10 ) );
    const maxStepX = Math.min( stepWidth, Math.ceil( maxRawStartStepX + 1e-10 ) );
    const maxStepY = Math.min( stepHeight, Math.ceil( maxRawStartStepY + 1e-10 ) );

    const lineStepWidth = maxStepX - minStepX;
    const lineStepHeight = maxStepY - minStepY;

    // We'll ignore intercepts of the specific direction when horizontal/vertical. These will be skipped later.
    if ( lineStepWidth > 1 && !isVertical ) {
      const firstY = startPoint.y + ( endPoint.y - startPoint.y ) * ( fromStepX( minStepX + 1 ) - startPoint.x ) / ( endPoint.x - startPoint.x );
      assert && assert( isFinite( firstY ) );
      yIntercepts.push( firstY );

      if ( lineStepWidth > 2 ) {
        const slopeIncrement = stepX * ( endPoint.y - startPoint.y ) / ( endPoint.x - startPoint.x );
        let y = firstY;
        for ( let j = minStepX + 2; j < maxStepX; j++ ) {
          y += slopeIncrement;

          // NOTE: We'll any intercept that matches a start/end point to match up exactly (we're working around
          // floating point error here)
          const x = fromStepX( j );
          if ( x === startPoint.x ) {
            assert && assert( Math.abs( y - startPoint.y ) < 1e-7 );
            y = startPoint.y;
          }
          if ( x === endPoint.x ) {
            assert && assert( Math.abs( y - endPoint.y ) < 1e-7 );
            y = endPoint.y;
          }

          assert && assert( isFinite( y ) );
          yIntercepts.push( y );
        }
      }
    }
    if ( lineStepHeight > 1 && !isHorizontal ) {
      const firstX = startPoint.x + ( endPoint.x - startPoint.x ) * ( fromStepY( minStepY + 1 ) - startPoint.y ) / ( endPoint.y - startPoint.y );
      assert && assert( isFinite( firstX ) );
      xIntercepts.push( firstX );

      if ( lineStepHeight > 2 ) {
        const slopeIncrement = stepY * ( endPoint.x - startPoint.x ) / ( endPoint.y - startPoint.y );
        let x = firstX;
        for ( let j = minStepY + 2; j < maxStepY; j++ ) {
          x += slopeIncrement;

          // NOTE: We'll any intercept that matches a start/end point to match up exactly (we're working around
          // floating point error here)
          const y = fromStepY( j );
          if ( y === startPoint.y ) {
            assert && assert( Math.abs( x - startPoint.x ) < 1e-7 );
            x = startPoint.x;
          }
          if ( y === endPoint.y ) {
            assert && assert( Math.abs( x - endPoint.x ) < 1e-7 );
            x = endPoint.x;
          }

          assert && assert( isFinite( x ) );
          xIntercepts.push( x );
        }
      }
    }

    // xxxx is the line segment (edge)
    // | and - notes the "clipped along cell bounds" sections
    //
    // minX  minStepX                   maxStepX        maxX
    //   ┌──────┬──────┬──────┬──────┬──────┬──────┬──────┐maxY
    //   │      │  x   │  x   │  x   │  x   │      │      │
    //   │  no  │ past │intern│intern│ not  │  no  │  no  │
    //   │effect│ half │      │      │ past │effect│effect│
    //   │corner│------│------│------│ half │corner│corner│
    //   ├──────┼──────┼──────┼──────┴──────┼──────┼──────┤maxStepY
    //   │  y  |│     |│     |│     |xx     │| y   │| y   │
    //   │ past|│     |│     |│    xx│|     │|past │|past │
    //   │ half|│     |│     |│  xx  │|     │|half │|half │
    //   │     |│------│------│xx    │|     │|     │|     │
    //   ├──────┼──────┼─────xx──────┼──────┼──────┼──────┤
    //   │  y  |│     |│   xx │------│|     │| y   │| y   │
    //   │inter|│     |│ xx   │|     │|     │|ntern│|ntern│
    //   │     |│      xx     │|     │|     │|     │|     │
    //   │     |│----xx│|     │|     │|     │|     │|     │
    //   ├──────┼──xx──┼──────┼──────┼──────┼──────┼──────┤
    //   │  y   │xx----│------│------│      │  y   │  y   │
    //   │ not  x      │      │      │      │ not  │ not  │
    //   │ past │      │      │      │      │ past │ past │
    //   │ half │      │      │      │      │ half │ half │
    //   ├──────┼──────┼──────┼──────┼──────┼──────┼──────┤minStepY
    //   │      │------│------│------│  x   │      │      │
    //   │  no  │  x   │      │      │ not  │  no  │  no  │
    //   │effect│ past │  x   │  x   │ past │effect│effect│
    //   │corner│ half │intern│intern│ half │corner│corner│
    //   └──────┴──────┴──────┴──────┴──────┴──────┴──────┘minY

    // Handle "internal" cases (the step rectangle that overlaps the line)
    if ( lineStepWidth === 1 && lineStepHeight === 1 ) {
      // If we only take up one cell, we can do a much more optimized form (AND in the future hopefully the clip
      // simplifier will be able to pass through vertices without GC

      callback(
        minStepX, minStepY,
        startPoint.x, startPoint.y,
        endPoint.x, endPoint.y,
        startPoint, endPoint
      );
    }
    else {
      // Do the "internal" grid
      for ( let iy = minStepY; iy < maxStepY; iy++ ) {
        // TODO: this could be optimized
        const cellMinY = fromStepY( iy );
        const cellMaxY = fromStepY( iy + 1 );

        const isFirstY = iy === minStepY;
        const isLastY = iy === maxStepY - 1;

        // The x intercepts for the minimal-y and maximal-y sides of the cell (or if we're on the first or last y cell, the endpoint)
        const minYXIntercept = isFirstY || isHorizontal ? ( startYLess ? startPoint.x : endPoint.x ) : xIntercepts[ iy - minStepY - 1 ];
        const maxYXIntercept = isLastY || isHorizontal ? ( startYLess ? endPoint.x : startPoint.x ) : xIntercepts[ iy - minStepY ];

        // Our range of intercepts (so we can quickly check in the inner iteration)
        const minXIntercept = Math.min( minYXIntercept, maxYXIntercept );
        const maxXIntercept = Math.max( minYXIntercept, maxYXIntercept );

        for ( let ix = minStepX; ix < maxStepX; ix++ ) {
          const cellMinX = fromStepX( ix );
          const cellMaxX = fromStepX( ix + 1 );

          const isFirstX = ix === minStepX;
          const isLastX = ix === maxStepX - 1;

          const minXYIntercept = isFirstX || isVertical ? ( startXLess ? startPoint.y : endPoint.y ) : yIntercepts[ ix - minStepX - 1 ];
          const maxXYIntercept = isLastX || isVertical ? ( startXLess ? endPoint.y : startPoint.y ) : yIntercepts[ ix - minStepX ];
          const minYIntercept = Math.min( minXYIntercept, maxXYIntercept );

          // NOTE: If we have horizontal/vertical lines, we'll need to change our logic slightly here
          const isLessThanMinX = isVertical ? cellMaxX < minXIntercept : cellMaxX <= minXIntercept;
          const isLessThanMinY = isHorizontal ? cellMaxY < minYIntercept : cellMaxY <= minYIntercept;

          // If this condition is true, the line does NOT pass through this cell. We just have to handle the corners.
          // NOTE: We're conditioning it on BOTH of these. Our intercept computations introduce floating point
          // error, which can cause issues if only one of these is true (we'll get the precise bits wrong).
          if ( cellMaxX < minXIntercept - 1e-6 || cellMinX > maxXIntercept + 1e-6 ) {
            // Since we are just handling corners, we can potentially have a horizontal edge and/or a vertical edge.
            // (NOTE: none, both, or one of these can be true).

            const isOnEndX = isFirstX || isLastX;
            const isOnEndY = isFirstY || isLastY;

            // If we're fully "internal", we'll have the spanning edge. If not, we'll need to check to see how we
            // compare to the center of the cell (remember, we are picking the closest corners to the start and end
            // of the line, so for us to have an edge here, the start/end have to be closer to different corners.
            // We've stored the rounded step coordinates, so we can just check against those.
            const hasHorizontal = isOnEndX ? ix >= roundedMinStepX && ( ix + 1 ) <= roundedMaxStepX : true;
            const hasVertical = isOnEndY ? iy >= roundedMinStepY && ( iy + 1 ) <= roundedMaxStepY : true;

            if ( hasHorizontal && hasVertical ) {
              // NOTE: This logic is based on examining the 8 cases we can have of "directed line segments that
              // pass by our cell without going through it". Basically, since we are guaranteed that both of the
              // x-intercepts are to the right OR left of the cell (in the same direction), and similarly for the
              // y-intercepts, that gives us 4 cases. For each of those, the line could be moving from one end to the
              // other (resulting in 8 cases).

              // If we have both, we will have a shared corner
              const cornerX = isLessThanMinX ? cellMaxX : cellMinX;
              const cornerY = isLessThanMinY ? cellMaxY : cellMinY;

              // There will also be two other points, one horizontally and one vertically offset from the corner
              const otherX = isLessThanMinX ? cellMinX : cellMaxX;
              const otherY = isLessThanMinY ? cellMinY : cellMaxY;

              // Compute whether we need to add the horizontal or vertical first.
              const xFirst = isLessThanMinX ? startXLess : !startXLess;

              const x0 = xFirst ? otherX : cornerX;
              const y0 = xFirst ? cornerY : otherY;
              const x2 = xFirst ? cornerX : otherX;
              const y2 = xFirst ? otherY : cornerY;

              assert && assert( x0 !== cornerX || y0 !== cornerY, 'Should not duplicate points' );
              callback(
                ix, iy,
                x0, y0,
                cornerX, cornerY,
                null, null
              );

              assert && assert( x2 !== cornerX || y2 !== cornerY, 'Should not duplicate points' );
              callback(
                ix, iy,
                cornerX, cornerY,
                x2, y2,
                null, null
              );
            }
            else if ( hasHorizontal ) {
              const y = isLessThanMinY ? cellMaxY : cellMinY;
              callback(
                ix, iy,
                startXLess ? cellMinX : cellMaxX, y,
                startXLess ? cellMaxX : cellMinX, y,
                null, null
              );
            }
            else if ( hasVertical ) {
              const x = isLessThanMinX ? cellMaxX : cellMinX;
              callback(
                ix, iy,
                x, startYLess ? cellMinY : cellMaxY,
                x, startYLess ? cellMaxY : cellMinY,
                null, null
              );
            }
          }
          else {
            // We go through the cell! Additionally due to previous filtering, we are pretty much guaranteed to touch
            // a cell side.

            // NOTE: We're patching in the reliable clipping method here. There seem to be a lot of numerical issues
            // when trying to use the intercepts directly

            const clippedStartPoint = scratchStartPoint.set( startPoint );
            const clippedEndPoint = scratchEndPoint.set( endPoint );

            const clipped = LineClipping.matthesDrakopoulosClip( clippedStartPoint, clippedEndPoint, cellMinX, cellMinY, cellMaxX, cellMaxY );

            let cellStartXLess;
            let cellStartYLess;
            let cellEndXLess;
            let cellEndYLess;

            const needsStartCorner = !clipped || !startPoint.equals( clippedStartPoint );
            const needsEndCorner = !clipped || !endPoint.equals( clippedEndPoint );

            // NaNs so TypeScript doesn't complain about unassigned. If it kills performance, presumably can just add
            // ts-expect-errors
            let startCornerX = NaN;
            let startCornerY = NaN;
            let endCornerX = NaN;
            let endCornerY = NaN;

            const existingStartPoint = needsStartCorner ? null : startPoint;
            const existingEndPoint = needsEndCorner ? null : endPoint;

            const cellCenterX = ( cellMinX + cellMaxX ) / 2;
            const cellCenterY = ( cellMinY + cellMaxY ) / 2; // NOTE: This could possibly be moved to an outer loop

            if ( needsStartCorner ) {
              cellStartXLess = startPoint.x < cellCenterX;
              cellStartYLess = startPoint.y < cellCenterY;
              startCornerX = cellStartXLess ? cellMinX : cellMaxX;
              startCornerY = cellStartYLess ? cellMinY : cellMaxY;
            }
            if ( needsEndCorner ) {
              cellEndXLess = endPoint.x < cellCenterX;
              cellEndYLess = endPoint.y < cellCenterY;
              endCornerX = cellEndXLess ? cellMinX : cellMaxX;
              endCornerY = cellEndYLess ? cellMinY : cellMaxY;
            }

            if ( clipped ) {
              if ( needsStartCorner && ( startCornerX !== clippedStartPoint.x || startCornerY !== clippedStartPoint.y ) ) {
                callback(
                  ix, iy,
                  startCornerX, startCornerY,
                  clippedStartPoint.x, clippedStartPoint.y,
                  null, existingStartPoint
                );
              }

              if ( !clippedStartPoint.equals( clippedEndPoint ) ) {
                callback(
                  ix, iy,
                  clippedStartPoint.x, clippedStartPoint.y,
                  clippedEndPoint.x, clippedEndPoint.y,
                  existingStartPoint, existingEndPoint
                );
              }

              if ( needsEndCorner && ( endCornerX !== clippedEndPoint.x || endCornerY !== clippedEndPoint.y ) ) {
                callback(
                  ix, iy,
                  clippedEndPoint.x, clippedEndPoint.y,
                  endCornerX, endCornerY,
                  existingEndPoint, null
                );
              }
            }
            else {
              if ( cellStartXLess !== cellEndXLess && cellStartYLess !== cellEndYLess ) {
                // we crossed from one corner to the opposite, but didn't hit. figure out which corner we passed
                // we're diagonal, so solving for y=cellCenterY should give us the info we need
                const y = startPoint.y + ( endPoint.y - startPoint.y ) * ( cellCenterX - startPoint.x ) / ( endPoint.x - startPoint.x );

                // Based on whether we are +x+y => -x-y or -x+y => +x-y
                const startSame = cellStartXLess === cellStartYLess;
                const yGreater = y > cellCenterY;

                const middlePoint = new Vector2(
                  startSame === yGreater ? cellMinX : cellMaxX,
                  yGreater ? cellMaxY : cellMinY
                );

                callback(
                  ix, iy,
                  startCornerX, startCornerY,
                  middlePoint.x, middlePoint.y,
                  null, null
                );
                callback(
                  ix, iy,
                  middlePoint.x, middlePoint.y,
                  endCornerX, endCornerY,
                  null, null
                );
              }
              else if ( startCornerX !== endCornerX || startCornerY !== endCornerY ) {
                callback(
                  ix, iy,
                  startCornerX, startCornerY,
                  endCornerX, endCornerY,
                  null, null
                );
              }
            }
          }
        }
      }
    }

    // x internal, y external
    for ( let ix = roundedMinStepX; ix < roundedMaxStepX; ix++ ) {
      const x0 = fromStepX( ix );
      const x1 = fromStepX( ix + 1 );

      // min-y side
      for ( let iy = 0; iy < minStepY; iy++ ) {
        const y = fromStepY( iy + 1 );
        callback(
          ix, iy,
          startXLess ? x0 : x1, y,
          startXLess ? x1 : x0, y,
          null, null
        );
      }
      // max-y side
      for ( let iy = maxStepY; iy < stepHeight; iy++ ) {
        const y = fromStepY( iy );
        callback(
          ix, iy,
          startXLess ? x0 : x1, y,
          startXLess ? x1 : x0, y,
          null, null
        );
      }
    }

    // y internal, x external
    for ( let iy = roundedMinStepY; iy < roundedMaxStepY; iy++ ) {
      const y0 = fromStepY( iy );
      const y1 = fromStepY( iy + 1 );

      // min-x side
      for ( let ix = 0; ix < minStepX; ix++ ) {
        const x = fromStepX( ix + 1 );
        callback(
          ix, iy,
          x, startYLess ? y0 : y1,
          x, startYLess ? y1 : y0,
          null, null
        );
      }
      // max-x side
      for ( let ix = maxStepX; ix < stepWidth; ix++ ) {
        const x = fromStepX( ix );
        callback(
          ix, iy,
          x, startYLess ? y0 : y1,
          x, startYLess ? y1 : y0,
          null, null
        );
      }
    }

    xIntercepts.length = 0;
    yIntercepts.length = 0;
  }
}

alpenglow.register( 'PolygonClipping', PolygonClipping );
