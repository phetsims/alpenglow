// Copyright 2023-2025, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import { alpenglow } from '../../alpenglow.js';
import type { ResourceSlot } from './ResourceSlot.js';
import type { BindingType } from './BindingType.js';

export class ResourceUsage {
  public constructor(
    public readonly resourceSlot: ResourceSlot,
    public readonly bindingType: BindingType
  ) {}

  public toDebugString(): string {
    return `ResourceUsage[slot:${this.resourceSlot.toDebugString()} type:${this.bindingType.toDebugString()}]`;
  }
}
alpenglow.register( 'ResourceUsage', ResourceUsage );