// Copyright 2023, University of Colorado Boulder

/**
 * A binding (type + location)
 *
 * TODO: Rename to Binding
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BindingType, BindingLocation } from '../imports.js';

export default class Binding {
  public constructor(
    public readonly binding: BindingType, // TODO: rename
    public readonly location: BindingLocation
  ) {}

  public getBindGroupLayoutEntry(): GPUBindGroupLayoutEntry {
    return this.binding.getBindGroupLayoutEntry( this.location.bindingIndex );
  }

  public getBindGroupEntry( resource: GPUBuffer | GPUTextureView ): GPUBindGroupEntry {
    return this.binding.getBindGroupEntry( this.location.bindingIndex, resource );
  }

  public getStorageAccess(): 'read' | 'read_write' {
    assert && assert( this.binding === BindingType.STORAGE_BUFFER || this.binding === BindingType.READ_ONLY_STORAGE_BUFFER );

    return this.binding === BindingType.READ_ONLY_STORAGE_BUFFER ? 'read' : 'read_write';
  }
}

alpenglow.register( 'Binding', Binding );
