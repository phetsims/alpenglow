// Copyright 2025, University of Colorado Boulder

/**
 * Internal gradient types
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

export enum RadialGradientType {
  Circular = 0,
  Strip = 1,
  FocalOnCircle = 2,
  Cone = 3
  // 2-bits, for binary serialization
}

export const RENDER_GRADIENT_TYPE_CONSTANTS = {
  GradientTypeCircular: RadialGradientType.Circular,
  GradientTypeStrip: RadialGradientType.Strip,
  GradientTypeFocalOnCircle: RadialGradientType.FocalOnCircle,
  GradientTypeCone: RadialGradientType.Cone
} as const;