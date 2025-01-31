// Copyright 2023-2025, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow } from '../../alpenglow.js';
import type { BindingType } from './BindingType.js';
import type { ResourceSlot } from './ResourceSlot.js';

export class BindingDescriptor {
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