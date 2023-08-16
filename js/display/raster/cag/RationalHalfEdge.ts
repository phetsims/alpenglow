// Copyright 2023, University of Colorado Boulder

/**
 * Represents a half-edge (directed line segment) with rational coordinates.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { BigRational, BigRationalVector2, RationalBoundary, RationalFace, scenery, WindingMap } from '../../../imports.js';
import Vector2 from '../../../../../dot/js/Vector2.js';

// Instead of storing vertices, we can get away with storing half-edges, with a linked list of next/previous and the
// opposite half edge. This is like a half-edge winged data structure.
export default class RationalHalfEdge {

  public face: RationalFace | null = null;
  public nextEdge: RationalHalfEdge | null = null;
  public previousEdge: RationalHalfEdge | null = null; // exists so we can enumerate edges at a vertex
  public boundary: RationalBoundary | null = null;

  public reversed!: RationalHalfEdge; // We will fill this in immediately
  public windingMap = new WindingMap();

  // 0 for straight +x, 1 for +y, 2 for straight -x, 3 for -y
  public discriminator!: number; // filled in immediately

  public slope!: BigRational; // filled in immediately

  public p0float: Vector2;
  public p1float: Vector2;

  public constructor(
    public readonly edgeId: number,
    public readonly p0: BigRationalVector2,
    public readonly p1: BigRationalVector2
  ) {
    this.p0float = new Vector2( p0.x.toFloat(), p0.y.toFloat() );
    this.p1float = new Vector2( p1.x.toFloat(), p1.y.toFloat() );
  }

  public static compareBigInt( a: bigint, b: bigint ): number {
    return a < b ? -1 : ( a > b ? 1 : 0 );
  }

  // Provides a stable comparison, but this is NOT numerical!!!
  public static quickCompareBigRational( a: BigRational, b: BigRational ): number {
    const numeratorCompare = RationalHalfEdge.compareBigInt( a.numerator, b.numerator );
    if ( numeratorCompare !== 0 ) {
      return numeratorCompare;
    }
    return RationalHalfEdge.compareBigInt( a.denominator, b.denominator );
  }

  public static quickCompareBigRationalVector2( a: BigRationalVector2, b: BigRationalVector2 ): number {
    const xCompare = RationalHalfEdge.quickCompareBigRational( a.x, b.x );
    if ( xCompare !== 0 ) {
      return xCompare;
    }
    return RationalHalfEdge.quickCompareBigRational( a.y, b.y );
  }

  public addWindingFrom( other: RationalHalfEdge ): void {
    this.windingMap.addWindingMap( other.windingMap );
  }

  public compare( other: RationalHalfEdge ): number {
    // can have an arbitrary sort for the first point
    const p0Compare = RationalHalfEdge.quickCompareBigRationalVector2( this.p0, other.p0 );
    if ( p0Compare !== 0 ) {
      return p0Compare;
    }

    // now an angle-based sort for the second point
    if ( this.discriminator < other.discriminator ) {
      return -1;
    }
    else if ( this.discriminator > other.discriminator ) {
      return 1;
    }
    // NOTE: using x/y "slope", so it's a bit inverted
    const slopeCompare = this.slope.compareCrossMul( other.slope );
    if ( slopeCompare !== 0 ) {
      return -slopeCompare;
    }

    // Now, we're sorting "identically overlapping" half-edges
    return this.edgeId < other.edgeId ? -1 : ( this.edgeId > other.edgeId ? 1 : 0 );
  }
}

scenery.register( 'RationalHalfEdge', RationalHalfEdge );
