// Copyright 2023, University of Colorado Boulder

/**
 * A bound TextureView
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, Binding, BoundResource } from '../../imports.js';

export default class BoundTextureView extends BoundResource<never> {
  public constructor(
    public readonly textureView: GPUTextureView,
    binding: Binding<never>
  ) {
    super( textureView, binding );
  }
}

alpenglow.register( 'BoundTextureView', BoundTextureView );
