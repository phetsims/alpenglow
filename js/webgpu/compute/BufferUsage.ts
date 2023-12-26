// Copyright 2023, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BindingType, ConcreteBufferSlot, ResourceUsage } from '../../imports.js';

export default class BufferUsage<T> extends ResourceUsage {
  public constructor(
    public readonly bufferSlot: ConcreteBufferSlot<T>,
    bindingType: BindingType
  ) {
    super( bufferSlot, bindingType );
  }
}
alpenglow.register( 'BufferUsage', BufferUsage );
