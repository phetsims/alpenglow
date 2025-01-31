// Copyright 2023-2025, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow } from '../../alpenglow.js';
import { BufferSlot } from './BufferSlot.js';
import type { ConcreteArrayType } from './ConcreteType.js';

// TODO: potential labels for buffer slots? (would need to be combined when buffer slots are shared)
export class BufferArraySlot<T = unknown> extends BufferSlot<T[]> {
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