// Copyright 2023-2025, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow } from '../../alpenglow.js';
import { Resource } from './Resource.js';
import type { Binding } from './Binding.js';

export class TextureViewResource extends Resource {
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

  public toDebugString(): string {
    return `TextureViewResource[#${this.id}${this.textureView.label ? ` label:${this.textureView.label}` : ''}]`;
  }
}
alpenglow.register( 'TextureViewResource', TextureViewResource );