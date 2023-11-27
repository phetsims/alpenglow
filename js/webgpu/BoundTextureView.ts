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
    boundBinding: Binding
  ) {
    super( textureView, boundBinding );
  }
}

alpenglow.register( 'BoundTextureView', BoundTextureView );
