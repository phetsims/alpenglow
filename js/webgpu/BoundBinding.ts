// Copyright 2023, University of Colorado Boulder

/**
 * A binding with a location
 *
 * TODO: Eventually, Binding will just be this?
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, Binding, BindingLocation } from '../imports.js';

export default class BoundBinding {
  public constructor(
    public readonly binding: Binding,
    public readonly location: BindingLocation
  ) {}

  public getBindGroupLayoutEntry(): GPUBindGroupLayoutEntry {
    return this.binding.getBindGroupLayoutEntry( this.location.bindingIndex );
  }

  public getBindGroupEntry( resource: GPUBuffer | GPUTextureView ): GPUBindGroupEntry {
    return this.binding.getBindGroupEntry( this.location.bindingIndex, resource );
  }

  public getStorageAccess(): 'read' | 'read_write' {
    assert && assert( this.binding === Binding.STORAGE_BUFFER || this.binding === Binding.READ_ONLY_STORAGE_BUFFER );

    return this.binding === Binding.READ_ONLY_STORAGE_BUFFER ? 'read' : 'read_write';
  }
}

alpenglow.register( 'BoundBinding', BoundBinding );
