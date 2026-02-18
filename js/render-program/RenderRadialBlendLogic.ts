// Copyright 2025-2026, University of Colorado Boulder

/**
 * Logic for a radial blend
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import Vector2 from '../../../dot/js/Vector2.js';
import Matrix3 from '../../../dot/js/Matrix3.js';
import type { RenderEvaluationContext } from './RenderEvaluationContext.js';
import { LinearEdge } from '../cag/LinearEdge.js';
import { RenderRadialBlendAccuracy } from './RenderRadialBlendAccuracy.js';

const scratchRadialBlendVector = new Vector2( 0, 0 );
const scratchVectorA = new Vector2( 0, 0 );
const scratchVectorB = new Vector2( 0, 0 );
const scratchVectorC = new Vector2( 0, 0 );
const scratchVectorD = new Vector2( 0, 0 );

export class RenderRadialBlendLogic {

  public readonly inverseTransform: Matrix3;

  public constructor(
    public readonly transform: Matrix3,
    public readonly radius0: number,
    public readonly radius1: number,
    public readonly accuracy: RenderRadialBlendAccuracy
  ) {
    this.inverseTransform = transform.inverted();
  }

  public equals( other: RenderRadialBlendLogic ): boolean {
    return this.transform.equalsEpsilon( other.transform, 1e-6 ) &&
           Math.abs( this.radius0 - other.radius0 ) < 1e-6 &&
           Math.abs( this.radius1 - other.radius1 ) < 1e-6 &&
           this.accuracy === other.accuracy;
  }

  public computeLinearValue(
    context: RenderEvaluationContext
  ): number {
    // TODO: flag to control whether this gets set? TODO: Flag to just use centroid
    let averageDistance;
    if ( this.accuracy === RenderRadialBlendAccuracy.Accurate ) {
      assert && assert( context.hasArea() );

      if ( context.face ) {
        averageDistance = context.face.getAverageDistanceTransformedToOrigin( this.inverseTransform, context.area );
      }
      else {
        // NOTE: Do the equivalent of the above, but without creating a face and a ton of garbage

        const p0 = this.inverseTransform.multiplyVector2( scratchVectorA.setXY( context.minX, context.minY ) );
        const p1 = this.inverseTransform.multiplyVector2( scratchVectorB.setXY( context.maxX, context.minY ) );
        const p2 = this.inverseTransform.multiplyVector2( scratchVectorC.setXY( context.maxX, context.maxY ) );
        const p3 = this.inverseTransform.multiplyVector2( scratchVectorD.setXY( context.minX, context.maxY ) );

        // Needs CCW orientation
        averageDistance = (
                            LinearEdge.evaluateLineIntegralDistance( p0.x, p0.y, p1.x, p1.y ) +
                            LinearEdge.evaluateLineIntegralDistance( p1.x, p1.y, p2.x, p2.y ) +
                            LinearEdge.evaluateLineIntegralDistance( p2.x, p2.y, p3.x, p3.y ) +
                            LinearEdge.evaluateLineIntegralDistance( p3.x, p3.y, p0.x, p0.y )
                          ) / ( context.area * this.inverseTransform.getSignedScale() );

        assert && assert( averageDistance === context.getFace().getAverageDistanceTransformedToOrigin( this.inverseTransform, context.area ) );
      }
    }
    else if ( this.accuracy === RenderRadialBlendAccuracy.Centroid ) {
      assert && assert( context.hasCentroid() );

      const localPoint = scratchRadialBlendVector.set( context.centroid );
      this.inverseTransform.multiplyVector2( localPoint );

      averageDistance = localPoint.magnitude;
    }
    else if ( this.accuracy === RenderRadialBlendAccuracy.PixelCenter ) {
      const localPoint = context.writeBoundsCentroid( scratchRadialBlendVector );
      this.inverseTransform.multiplyVector2( localPoint );

      averageDistance = localPoint.magnitude;
    }
    else {
      throw new Error( 'unreachable' );
    }
    assert && assert( isFinite( averageDistance ) );

    // if ( assert ) {
    //
    //   const maxDistance = Math.sqrt( ( maxX - minX ) ** 2 + ( maxY - minY ) ** 2 );
    //   assert( Math.abs( averageDistance - localPoint.magnitude ) < maxDistance * 5 );
    // }

    // TODO: assuming no actual order, BUT needs positive radii?
    const t = ( averageDistance - this.radius0 ) / ( this.radius1 - this.radius0 );
    assert && assert( isFinite( t ) );

    return t;
  }

  public isLinear(): boolean {
    return false;
  }
}