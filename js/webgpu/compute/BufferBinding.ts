// Copyright 2023-2024, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow } from '../../alpenglow.js';
import { Binding } from './Binding.js';
import type { BindingLocation } from './BindingLocation.js';
import type { BindingType } from './BindingType.js';
import type { BufferSlot } from './BufferSlot.js';

export class BufferBinding<T> extends Binding {
  public constructor(
    location: BindingLocation,
    bindingType: BindingType,
    public readonly bufferSlot: BufferSlot<T>
  ) {
    super( location, bindingType, bufferSlot );
  }
}
alpenglow.register( 'BufferBinding', BufferBinding );