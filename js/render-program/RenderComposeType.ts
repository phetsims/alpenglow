// Copyright 2023-2026, University of Colorado Boulder

/**
 * Porter-duff compositing types
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

export enum RenderComposeType {
  Over = 0,
  In = 1,
  Out = 2,
  Atop = 3,
  Xor = 4,
  Plus = 5,
  PlusLighter = 6
  // 3 bits in binary representation
}

export const RENDER_COMPOSE_CONSTANTS = {
  ComposeOver: RenderComposeType.Over,
  ComposeIn: RenderComposeType.In,
  ComposeOut: RenderComposeType.Out,
  ComposeAtop: RenderComposeType.Atop,
  ComposeXor: RenderComposeType.Xor,
  ComposePlus: RenderComposeType.Plus,
  ComposePlusLighter: RenderComposeType.PlusLighter
} as const;
