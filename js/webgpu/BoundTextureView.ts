// Copyright 2023, University of Colorado Boulder

/**
 * A bound TextureView
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, Binding, BoundResource } from '../imports.js';

export default class BoundTextureView extends BoundResource {
  public constructor(
    public readonly textureView: GPUTextureView,
    binding: Binding
  ) {
    super( textureView, binding );
  }
}

alpenglow.register( 'BoundTextureView', BoundTextureView );
