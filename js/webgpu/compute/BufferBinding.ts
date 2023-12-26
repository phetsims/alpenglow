// Copyright 2023, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, Binding, BindingLocation, BindingType, ConcreteBufferSlot } from '../../imports.js';

export default class BufferBinding<T> extends Binding {
  public constructor(
    location: BindingLocation,
    bindingType: BindingType,
    public readonly bufferSlot: ConcreteBufferSlot<T>
  ) {
    super( location, bindingType, bufferSlot );
  }
}
alpenglow.register( 'BufferBinding', BufferBinding );
