// Copyright 2023-2025, University of Colorado Boulder

/**
 * A loop of rational half-edges
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import Bounds2 from '../../../dot/js/Bounds2.js';
import Matrix3 from '../../../dot/js/Matrix3.js';
import Vector2 from '../../../dot/js/Vector2.js';
import { alpenglow } from '../alpenglow.js';
import { LinearEdge } from './LinearEdge.js';
import type { RationalHalfEdge } from './RationalHalfEdge.js';
import type { BigRationalVector2 } from './BigRationalVector2.js';

export class RationalBoundary {
  public readonly edges: RationalHalfEdge[] = [];
  public signedArea!: number;
  public bounds!: Bounds2;
  public minimalXRationalPoint!: BigRationalVector2;

  public computeProperties(): void {
    let signedArea = 0;
    const bounds = Bounds2.NOTHING.copy();
    let minimalXP0Edge = this.edges[ 0 ];

    for ( let i = 0; i < this.edges.length; i++ ) {
      const edge = this.edges[ i % this.edges.length ];

      if ( edge.p0.x.compareCrossMul( minimalXP0Edge.p0.x ) < 0 ) {
        minimalXP0Edge = edge;
      }

      const p0float = edge.p0float;
      const p1float = edge.p1float;

      bounds.addPoint( p0float );

      // PolygonIntegrals.evaluateShoelaceArea( p0.x, p0.y, p1.x, p1.y );
      signedArea += 0.5 * ( p1float.x + p0float.x ) * ( p1float.y - p0float.y );
    }

    this.minimalXRationalPoint = minimalXP0Edge.p0;
    this.bounds = bounds;
    this.signedArea = signedArea;
  }

  public containsPoint( point: BigRationalVector2 ): boolean {
    let windingNumber = 0;

    for ( let i = 0; i < this.edges.length; i++ ) {
      windingNumber += this.edges[ i ].windingContribution( point.x, point.y );
    }

    return windingNumber !== 0;
  }

  public toTransformedPolygon( matrix: Matrix3 ): Vector2[] {
    const result: Vector2[] = [];
    for ( let i = 0; i < this.edges.length; i++ ) {
      result.push( matrix.timesVector2( this.edges[ i ].p0float ) );
    }
    return result;
  }

  public toTransformedLinearEdges( matrix: Matrix3 ): LinearEdge[] {
    const result: LinearEdge[] = [];
    for ( let i = 0; i < this.edges.length; i++ ) {
      const edge = this.edges[ i ];
      result.push( new LinearEdge(
        matrix.timesVector2( edge.p0float ),
        matrix.timesVector2( edge.p1float )
      ) );
    }
    return result;
  }
}

alpenglow.register( 'RationalBoundary', RationalBoundary );