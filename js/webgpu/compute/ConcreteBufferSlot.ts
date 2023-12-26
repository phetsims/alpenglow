// Copyright 2023, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BufferSlot, ConcreteType } from '../../imports.js';

export default class ConcreteBufferSlot<T> extends BufferSlot {
  public constructor(
    public readonly concreteType: ConcreteType<T>
  ) {
    super( concreteType.bytesPerElement );
  }
}
alpenglow.register( 'ConcreteBufferSlot', ConcreteBufferSlot );
