// Copyright 2023-2026, University of Colorado Boulder

/**
 * How things can extend outside of their normal bounds (images, gradients, etc.)
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

export enum RenderExtend {
  Pad = 0,
  Reflect = 1,
  Repeat = 2
}

export const RENDER_EXTEND_CONSTANTS = {
  ExtendPad: RenderExtend.Pad,
  ExtendReflect: RenderExtend.Reflect,
  ExtendRepeat: RenderExtend.Repeat
} as const;
