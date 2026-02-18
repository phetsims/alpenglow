// Copyright 2025-2026, University of Colorado Boulder

/**
 * Logic for a radial gradient
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import Vector2 from '../../../dot/js/Vector2.js';
import Matrix3 from '../../../dot/js/Matrix3.js';
import { RadialGradientType } from './RadialGradientType.js';
import { RenderExtend } from './RenderExtend.js';
import type { RenderEvaluationContext } from './RenderEvaluationContext.js';
import { RenderImage } from './RenderImage.js';

import { RenderRadialGradientAccuracy } from './RenderRadialGradientAccuracy.js';

const scratchVectorA = new Vector2( 0, 0 );
const fromPoly2 = ( p0: Vector2, p1: Vector2 ): Matrix3 => {
  return Matrix3.affine(
    p1.y - p0.y, p1.x - p0.x, p0.x,
    p0.x - p1.x, p1.y - p0.y, p0.y
  );
  // TODO: remove comments once tested
  // return Transform(
  //   vec4(p1.y - p0.y, p0.x - p1.x, p1.x - p0.x, p1.y - p0.y),
  //   vec2(p0.x, p0.y)
  // );
};
const twoPointToUnitLine = ( p0: Vector2, p1: Vector2 ): Matrix3 => {
  return fromPoly2( Vector2.ZERO, Vector2.X_UNIT ).timesMatrix( fromPoly2( p0, p1 ).inverted() );
};

export class RenderRadialGradientLogic {

  public constructor(
    public readonly conicTransform: Matrix3,
    public readonly focalX: number,
    public readonly radius: number,
    public readonly kind: RadialGradientType,
    public readonly isSwapped: boolean,
    public readonly ratios: number[], // should be sorted!!
    public readonly extend: RenderExtend,
    public readonly accuracy: RenderRadialGradientAccuracy
  ) {}

  public static from(
    transform: Matrix3,
    start: Vector2,
    startRadius: number,
    end: Vector2,
    endRadius: number,
    ratios: number[], // should be sorted!!
    extend: RenderExtend,
    accuracy: RenderRadialGradientAccuracy
  ): RenderRadialGradientLogic {
    // Two-point conical gradient based on Vello, based on https://skia.org/docs/dev/design/conical/
    let p0 = start;
    let p1 = end;
    let r0 = startRadius;
    let r1 = endRadius;

    const GRADIENT_EPSILON = 1 / ( 1 << 12 );
    const userToGradient = transform.inverted();

    // Output variables
    let conicTransform: Matrix3 | null = null;
    let focalX = 0;
    let radius = 0;
    let kind: RadialGradientType;
    let isSwapped = false;

    if ( Math.abs( r0 - r1 ) <= GRADIENT_EPSILON ) {
      // When the radii are the same, emit a strip gradient
      kind = RadialGradientType.Strip;
      const scaled = r0 / p0.distance( p1 ); // TODO: how to handle div by zero?
      conicTransform = twoPointToUnitLine( p0, p1 ).timesMatrix( userToGradient );
      radius = scaled * scaled;
    }
    else {
      // Assume a two point conical gradient unless the centers
      // are equal.
      kind = RadialGradientType.Cone;
      if ( p0.equals( p1 ) ) {
        kind = RadialGradientType.Circular;
        // Nudge p0 a bit to avoid denormals.
        p0.addScalar( GRADIENT_EPSILON );
      }
      if ( r1 === 0 ) {
        // If r1 === 0, swap the points and radii
        isSwapped = true;
        const tmp_p = p0;
        p0 = p1;
        p1 = tmp_p;
        const tmp_r = r0;
        r0 = r1;
        r1 = tmp_r;
      }
      focalX = r0 / ( r0 - r1 );
      const cf = p0.timesScalar( 1 - focalX ).add( p1.timesScalar( focalX ) );
      radius = r1 / cf.distance( p1 );
      const user_to_unit_line = twoPointToUnitLine( cf, p1 ).timesMatrix( userToGradient );
      let user_to_scaled = user_to_unit_line;
      // When r === 1, focal point is on circle
      if ( Math.abs( radius - 1 ) <= GRADIENT_EPSILON ) {
        kind = RadialGradientType.FocalOnCircle;
        const scale = 0.5 * Math.abs( 1 - focalX );
        user_to_scaled = Matrix3.scaling( scale ).timesMatrix( user_to_unit_line );
      }
      else {
        const a = radius * radius - 1;
        const scale_ratio = Math.abs( 1 - focalX ) / a;
        const scale_x = radius * scale_ratio;
        const scale_y = Math.sqrt( Math.abs( a ) ) * scale_ratio;
        user_to_scaled = Matrix3.scaling( scale_x, scale_y ).timesMatrix( user_to_unit_line );
      }
      conicTransform = user_to_scaled;
    }

    return new RenderRadialGradientLogic(
      conicTransform,
      focalX,
      radius,
      kind,
      isSwapped,
      ratios,
      extend,
      accuracy
    );
  }

  public equals( other: RenderRadialGradientLogic ): boolean {
    return this.conicTransform.equalsEpsilon( other.conicTransform, 1e-6 ) &&
           Math.abs( this.focalX - other.focalX ) < 1e-6 &&
           Math.abs( this.radius - other.radius ) < 1e-6 &&
           this.kind === other.kind &&
           this.isSwapped === other.isSwapped &&
           this.ratios.length === other.ratios.length &&
           _.every( this.ratios, ( ratio, i ) => Math.abs( ratio - other.ratios[ i ] ) < 1e-6 ) &&
           this.extend === other.extend &&
           this.accuracy === other.accuracy;
  }

  public computeLinearValue(
    context: RenderEvaluationContext
  ): number {
    const focalX = this.focalX;
    const radius = this.radius;
    const kind = this.kind;
    const is_swapped = this.isSwapped;

    // TODO: remove comments once tested
    const is_strip = kind === RadialGradientType.Strip;
    const is_circular = kind === RadialGradientType.Circular;
    const is_focal_on_circle = kind === RadialGradientType.FocalOnCircle;
    const r1_recip = is_circular ? 0 : 1 / radius;
    // let r1_recip = select(1 / radius, 0, is_circular);
    const less_scale = is_swapped || ( 1 - focalX ) < 0 ? -1 : 1;
    // let less_scale = select(1, -1, is_swapped || (1 - focalX) < 0);
    const t_sign = Math.sign( 1 - focalX );

    const point = (
                    this.accuracy === RenderRadialGradientAccuracy.UnsplitCentroid ||
                    this.accuracy === RenderRadialGradientAccuracy.SplitCentroid ||
                    this.accuracy === RenderRadialGradientAccuracy.SplitAccurate
                  ) ? context.centroid : context.writeBoundsCentroid( scratchVectorA );

    // Pixel-specifics
    const local_xy = this.conicTransform.timesVector2( point );
    const x = local_xy.x;
    const y = local_xy.y;
    const xx = x * x;
    const yy = y * y;
    let t = 0;
    let is_valid = true;
    if ( is_strip ) {
      const a = radius - yy;
      t = Math.sqrt( a ) + x;
      is_valid = a >= 0;
    }
    else if ( is_focal_on_circle ) {
      t = ( xx + yy ) / x;
      is_valid = t >= 0 && x !== 0;
    }
    else if ( radius > 1 ) {
      t = Math.sqrt( xx + yy ) - x * r1_recip;
    }
    else { // radius < 1
      const a = xx - yy;
      t = less_scale * Math.sqrt( a ) - x * r1_recip;
      is_valid = a >= 0 && t >= 0;
    }
    if ( is_valid ) {
      t = RenderImage.extend( this.extend, focalX + t_sign * t );
      if ( is_swapped ) {
        t = 1 - t;
      }
      return t;
    }
    else {
      return NaN;
    }
  }

  public isLinear(): boolean {
    return false;
  }
}