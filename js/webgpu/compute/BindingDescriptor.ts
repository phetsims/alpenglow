// Copyright 2023, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BindingType, ResourceSlot } from '../../imports.js';

export default class BindingDescriptor {
  public constructor(
    public readonly bindingIndex: number,
    public readonly bindingType: BindingType,
    public readonly slot: ResourceSlot
  ) {}

  public getBindGroupLayoutEntry(): GPUBindGroupLayoutEntry {
    return this.bindingType.getBindGroupLayoutEntry( this.bindingIndex );
  }
}
alpenglow.register( 'BindingDescriptor', BindingDescriptor );