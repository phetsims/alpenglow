// Copyright 2023, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BufferSlot, ConcreteArrayType } from '../../imports.js';

export default class BufferArraySlot<T = unknown> extends BufferSlot<T[]> {
  public constructor(
    public readonly concreteArrayType: ConcreteArrayType<T>
  ) {
    super( concreteArrayType );
  }

  public get length(): number {
    return this.concreteArrayType.length;
  }
}
alpenglow.register( 'BufferArraySlot', BufferArraySlot );
