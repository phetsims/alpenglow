// Copyright 2023-2026, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import type { Binding } from './Binding.js';
import { Resource } from './Resource.js';

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
