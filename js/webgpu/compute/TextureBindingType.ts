// Copyright 2023-2026, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import { alpenglow } from '../../alpenglow.js';
import { BindingType } from './BindingType.js';

export class TextureBindingType extends BindingType {
  public constructor(
    public readonly sampleType: GPUTextureSampleType,
    public readonly viewDimension: GPUTextureViewDimension = '2d',
    public readonly multisampled = false
  ) {
    super();
  }

  public toDebugString(): string {
    return `TextureBindingType[${this.sampleType}, ${this.viewDimension}, ${this.multisampled}]`;
  }

  public combined( other: BindingType ): BindingType | null {
    if (
      other instanceof TextureBindingType &&
      this.sampleType === other.sampleType &&
      this.viewDimension === other.viewDimension &&
      this.multisampled === other.multisampled ) {
      return this;
    }
    else {
      return null;
    }
  }

  protected override mutateBindGroupLayoutEntry( entry: GPUBindGroupLayoutEntry ): void {
    entry.texture = {
      sampleType: this.sampleType,
      viewDimension: this.viewDimension,
      multisampled: this.multisampled
    };
  }
}
alpenglow.register( 'TextureBindingType', TextureBindingType );