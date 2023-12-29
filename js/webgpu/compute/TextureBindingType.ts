// Copyright 2023, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BindingType } from '../../imports.js';

export default class TextureBindingType extends BindingType {
  public constructor(
    public readonly sampleType: GPUTextureSampleType,
    public readonly viewDimension: GPUTextureViewDimension = '2d',
    public readonly multisampled: boolean = false
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
