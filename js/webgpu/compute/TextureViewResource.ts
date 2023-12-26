// Copyright 2023, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, Binding, Resource } from '../../imports.js';

export default class TextureViewResource extends Resource {
  public constructor(
    public readonly textureView: GPUTextureView
  ) {
    super( textureView );
  }

  public getBindGroupEntry( binding: Binding ): GPUBindGroupEntry {
    return {
      binding: binding.location.bindingIndex,
      resource: this.textureView
    };
  }
}
alpenglow.register( 'TextureViewResource', TextureViewResource );