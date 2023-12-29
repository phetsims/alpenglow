// Copyright 2023, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BindingType } from '../../imports.js';

export default class StorageTextureBindingType extends BindingType {
  public constructor(
    public readonly access: GPUStorageTextureAccess,
    public readonly format: GPUTextureFormat,
    public readonly viewDimension: GPUTextureViewDimension = '2d'
  ) {
    super();
  }

  public toDebugString(): string {
    return `StorageTextureBindingType[${this.access}, ${this.format}, ${this.viewDimension}]`;
  }

  public combined( other: BindingType ): BindingType | null {
    if (
      other instanceof StorageTextureBindingType &&
      this.access === other.access &&
      this.format === other.format &&
      this.viewDimension === other.viewDimension ) {
      return this;
    }
    else {
      return null;
    }
  }

  protected override mutateBindGroupLayoutEntry( entry: GPUBindGroupLayoutEntry ): void {
    entry.storageTexture = {
      access: this.access,
      format: this.format,
      viewDimension: this.viewDimension
    };
  }
}
alpenglow.register( 'StorageTextureBindingType', StorageTextureBindingType );
