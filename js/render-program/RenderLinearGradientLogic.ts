// Copyright 2025-2026, University of Colorado Boulder

/**
 * Logic for a linear gradient
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import Vector2 from '../../../dot/js/Vector2.js';
import Matrix3 from '../../../dot/js/Matrix3.js';
import { RenderExtend } from './RenderExtend.js';
import type { RenderEvaluationContext } from './RenderEvaluationContext.js';
import { RenderImage } from './RenderImage.js';

import { RenderLinearGradientAccuracy } from './RenderLinearGradientAccuracy.js';

const scratchLinearGradientVector0 = new Vector2( 0, 0 );

export class RenderLinearGradientLogic {

  private readonly isIdentity: boolean;

  public constructor(
    public readonly inverseTransform: Matrix3,
    public readonly start: Vector2,
    public readonly gradDelta: Vector2,
    public readonly ratios: number[],
    public readonly extend: RenderExtend,
    public readonly accuracy: RenderLinearGradientAccuracy
  ) {
    // Not computed on GPU?
    this.isIdentity = inverseTransform.isIdentity();
  }

  public static from(
    transform: Matrix3,
    start: Vector2,
    end: Vector2,
    ratios: number[],
    extend: RenderExtend,
    accuracy: RenderLinearGradientAccuracy
  ): RenderLinearGradientLogic {
    const inverseTransform = transform.inverted();
    const gradDelta = end.minus( start );

    return new RenderLinearGradientLogic( inverseTransform, start, gradDelta, ratios, extend, accuracy );
  }

  public equals( other: RenderLinearGradientLogic ): boolean {
    return this.inverseTransform.equalsEpsilon( other.inverseTransform, 1e-6 ) &&
           this.start.equalsEpsilon( other.start, 1e-6 ) &&
           this.gradDelta.equalsEpsilon( other.gradDelta, 1e-6 ) &&
           this.ratios.length === other.ratios.length &&
           this.ratios.every( ( ratio, i ) => Math.abs( ratio - other.ratios[ i ] ) < 1e-6 ) &&
           this.extend === other.extend &&
           this.accuracy === other.accuracy;
  }

  public computeLinearValue(
    context: RenderEvaluationContext
  ): number {
    const useCentroid = this.accuracy === RenderLinearGradientAccuracy.UnsplitCentroid ||
                        this.accuracy === RenderLinearGradientAccuracy.SplitAccurate;

    assert && useCentroid && assert( context.hasCentroid() );

    const localPoint = useCentroid ?
                       scratchLinearGradientVector0.set( context.centroid ) :
                       context.writeBoundsCentroid( scratchLinearGradientVector0 );

    if ( !this.isIdentity ) {
      this.inverseTransform.multiplyVector2( localPoint );
    }

    const localDelta = localPoint.subtract( this.start ); // MUTABLE, changes localPoint
    const gradDelta = this.gradDelta;

    const rawT = gradDelta.magnitude > 0 ? localDelta.dot( gradDelta ) / gradDelta.dot( gradDelta ) : 0;

    return RenderImage.extend( this.extend, rawT );
  }

  public isLinear(): boolean {
    return true;
  }
}