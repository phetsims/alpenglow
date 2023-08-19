// Copyright 2023, University of Colorado Boulder

/**
 * A line-segment edge with integer coordinates, as part of the rendering
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { RationalIntersection, RenderPath, scenery } from '../../../imports.js';
import Bounds2 from '../../../../../dot/js/Bounds2.js';
import Utils from '../../../../../dot/js/Utils.js';
import Vector2 from '../../../../../dot/js/Vector2.js';
import Matrix3 from '../../../../../dot/js/Matrix3.js';

export default class IntegerEdge {

  public readonly bounds: Bounds2;
  public readonly intersections: RationalIntersection[] = [];

  public constructor(
    public readonly renderPath: RenderPath,
    public readonly x0: number,
    public readonly y0: number,
    public readonly x1: number,
    public readonly y1: number
  ) {
    assert && assert( Number.isInteger( x0 ) );
    assert && assert( Number.isInteger( y0 ) );
    assert && assert( Number.isInteger( x1 ) );
    assert && assert( Number.isInteger( y1 ) );
    assert && assert( x0 !== x1 || y0 !== y1 );

    // TODO: maybe don't compute this here? Can we compute it in the other work?
    this.bounds = new Bounds2(
      Math.min( x0, x1 ),
      Math.min( y0, y1 ),
      Math.max( x0, x1 ),
      Math.max( y0, y1 )
    );
  }

  public hasBoundsIntersectionWith( other: IntegerEdge ): boolean {
    return IntegerEdge.hasBoundsIntersection(
      this.bounds,
      other.bounds,
      this.x0 === this.x1 || other.x0 === other.x1,
      this.y0 === this.y1 || other.y0 === other.y1
    );
  }

  // If one of the segments is (e.g.) vertical, we'll need to allow checks for overlap ONLY on the x value, otherwise
  // we can have a strict inequality check. This also applies to horizontal segments and the y value.
  // The reason this is OK is because if the segments are both (e.g.) non-vertical, then if the bounds only meet
  // at a single x value (and not a continuos area of overlap), THEN the only intersection would be at the
  // endpoints (which we would filter out and not want anyway).
  public static hasBoundsIntersection( boundsA: Bounds2, boundsB: Bounds2, someXEqual: boolean, someYEqual: boolean ): boolean {
    // Bounds min/max for overlap checks
    const minX = Math.max( boundsA.minX, boundsB.minX );
    const minY = Math.max( boundsA.minY, boundsB.minY );
    const maxX = Math.min( boundsA.maxX, boundsB.maxX );
    const maxY = Math.min( boundsA.maxY, boundsB.maxY );

    return ( someXEqual ? ( maxX >= minX ) : ( maxX > minX ) ) && ( someYEqual ? ( maxY >= minY ) : ( maxY > minY ) );
  }

  public static createTransformed( path: RenderPath, toIntegerMatrix: Matrix3, p0: Vector2, p1: Vector2 ): IntegerEdge | null {
    const m00 = toIntegerMatrix.m00();
    const m01 = toIntegerMatrix.m01();
    const m02 = toIntegerMatrix.m02();
    const m10 = toIntegerMatrix.m10();
    const m11 = toIntegerMatrix.m11();
    const m12 = toIntegerMatrix.m12();
    const x0 = Utils.roundSymmetric( p0.x * m00 + p0.y * m01 + m02 );
    const y0 = Utils.roundSymmetric( p0.x * m10 + p0.y * m11 + m12 );
    const x1 = Utils.roundSymmetric( p1.x * m00 + p1.y * m01 + m02 );
    const y1 = Utils.roundSymmetric( p1.x * m10 + p1.y * m11 + m12 );
    if ( x0 !== x1 || y0 !== y1 ) {
      return new IntegerEdge( path, x0, y0, x1, y1 );
    }
    else {
      return null;
    }
  }
}

scenery.register( 'IntegerEdge', IntegerEdge );
