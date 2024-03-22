// Copyright 2023, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, Binding, BindingLocation, BindingType, BufferSlot } from '../../imports.js';

export default class BufferBinding<T> extends Binding {
  public constructor(
    location: BindingLocation,
    bindingType: BindingType,
    public readonly bufferSlot: BufferSlot<T>
  ) {
    super( location, bindingType, bufferSlot );
  }
}
alpenglow.register( 'BufferBinding', BufferBinding );