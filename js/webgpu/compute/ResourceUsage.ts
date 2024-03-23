// Copyright 2023-2024, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BindingType, ResourceSlot } from '../../imports.js';

export default class ResourceUsage {
  public constructor(
    public readonly resourceSlot: ResourceSlot,
    public readonly bindingType: BindingType
  ) {}

  public toDebugString(): string {
    return `ResourceUsage[slot:${this.resourceSlot.toDebugString()} type:${this.bindingType.toDebugString()}]`;
  }
}
alpenglow.register( 'ResourceUsage', ResourceUsage );