// Copyright 2023-2025, University of Colorado Boulder

/**
 * Stores a RenderProgram for light direction and color
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow } from '../alpenglow.js';
import type { RenderProgram } from './RenderProgram.js';

export class RenderLight {
  public constructor(
    // The direction TO the light from the surface
    public readonly directionProgram: RenderProgram,

    // The color of the light
    public readonly colorProgram: RenderProgram
  ) {
    assert && assert( directionProgram );
    assert && assert( colorProgram );
  }
}

alpenglow.register( 'RenderLight', RenderLight );