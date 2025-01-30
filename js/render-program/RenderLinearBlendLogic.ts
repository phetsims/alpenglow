// Copyright 2025, University of Colorado Boulder

/**
 * Logic for a linear blend
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import Vector2 from '../../../dot/js/Vector2.js';
import type { RenderEvaluationContext } from './RenderEvaluationContext.js';
import { RenderLinearBlendAccuracy } from './RenderLinearBlendAccuracy.js';

export class RenderLinearBlendLogic {

  public constructor(
    public readonly scaledNormal: Vector2,
    public readonly offset: number,
    public readonly accuracy: RenderLinearBlendAccuracy
  ) {}

  public equals( other: RenderLinearBlendLogic ): boolean {
    return this.scaledNormal.equalsEpsilon( other.scaledNormal, 1e-6 ) &&
           Math.abs( this.offset - other.offset ) < 1e-6 &&
           this.accuracy === other.accuracy;
  }

  public computeLinearValue(
    context: RenderEvaluationContext
  ): number {
    const dot = this.accuracy === RenderLinearBlendAccuracy.Accurate ?
                this.scaledNormal.dot( context.centroid ) :
                this.scaledNormal.x * context.getCenterX() + this.scaledNormal.y * context.getCenterY();

    return dot - this.offset;
  }

  public isLinear(): boolean {
    return true;
  }
}