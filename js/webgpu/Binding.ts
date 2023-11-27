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
    public readonly type: BindingType,
    public readonly location: BindingLocation
  ) {}

  public getBindGroupLayoutEntry(): GPUBindGroupLayoutEntry {
    return this.type.getBindGroupLayoutEntry( this.location.bindingIndex );
  }

  public getBindGroupEntry( resource: GPUBuffer | GPUTextureView ): GPUBindGroupEntry {
    return this.type.getBindGroupEntry( this.location.bindingIndex, resource );
  }

  public getStorageAccess(): 'read' | 'read_write' {
    assert && assert( this.type === BindingType.STORAGE_BUFFER || this.type === BindingType.READ_ONLY_STORAGE_BUFFER );

    return this.type === BindingType.READ_ONLY_STORAGE_BUFFER ? 'read' : 'read_write';
  }
}

alpenglow.register( 'Binding', Binding );
