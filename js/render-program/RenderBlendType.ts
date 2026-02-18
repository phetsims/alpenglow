// Copyright 2023-2026, University of Colorado Boulder

/**
 * Three-channel blending of colors
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import { alpenglow } from '../alpenglow.js';

export enum RenderBlendType {
  Normal = 0,
  Multiply = 1,
  Screen = 2,
  Overlay = 3,
  Darken = 4,
  Lighten = 5,
  ColorDodge = 6,
  ColorBurn = 7,
  HardLight = 8,
  SoftLight = 9,
  Difference = 10,
  Exclusion = 11,
  Hue = 12,
  Saturation = 13,
  Color = 14,
  Luminosity = 15
  // 4 bits in binary representation
}

alpenglow.register( 'RenderBlendType', RenderBlendType );

export const RENDER_BLEND_CONSTANTS = {
  BlendNormal: RenderBlendType.Normal,
  BlendMultiply: RenderBlendType.Multiply,
  BlendScreen: RenderBlendType.Screen,
  BlendOverlay: RenderBlendType.Overlay,
  BlendDarken: RenderBlendType.Darken,
  BlendLighten: RenderBlendType.Lighten,
  BlendColorDodge: RenderBlendType.ColorDodge,
  BlendColorBurn: RenderBlendType.ColorBurn,
  BlendHardLight: RenderBlendType.HardLight,
  BlendSoftLight: RenderBlendType.SoftLight,
  BlendDifference: RenderBlendType.Difference,
  BlendExclusion: RenderBlendType.Exclusion,
  BlendHue: RenderBlendType.Hue,
  BlendSaturation: RenderBlendType.Saturation,
  BlendColor: RenderBlendType.Color,
  BlendLuminosity: RenderBlendType.Luminosity
} as const;