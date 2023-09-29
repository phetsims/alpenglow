// Copyright 2023, University of Colorado Boulder

/**
 * Clipping arbitrary (degenerate, non-convex, self-intersecting, etc.) polygons based on binary criteria (e.g.
 * left/right, inside/outside).
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */
import Vector2 from '../../../dot/js/Vector2.js';
import { alpenglow, ClipSimplifier, EdgedClippedFace, LinearEdge } from '../imports.js';

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

export default class BinaryClipping {

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
