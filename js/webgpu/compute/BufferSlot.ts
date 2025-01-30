// Copyright 2023-2024, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow } from '../../alpenglow.js';
import { ResourceSlot } from './ResourceSlot.js';
import { BufferSlotSlice } from './BufferSlotSlice.js';
import type { ConcreteType } from './ConcreteType.js';

export class BufferSlot<T = unknown> extends ResourceSlot {
  public readonly bufferSlotSlices: BufferSlotSlice[] = [];
  public readonly size: number;

  public constructor(
    public readonly concreteType: ConcreteType<T>
  ) {
    super();

    this.size = concreteType.bytesPerElement;
  }

  public hasChildSlot( slot: BufferSlot ): boolean {
    return this.bufferSlotSlices.some( slice => slice.bufferSlot === slot );
  }

  public getSubtreeSlots(): BufferSlot[] {
    return _.uniq( [
      this as BufferSlot,
      ...this.bufferSlotSlices.flatMap( slice => slice.bufferSlot.getSubtreeSlots() )
    ] );
  }

  public toDebugString(): string {
    return `BufferSlot[#${this.id} size:${this.size} type:${this.concreteType.name}]`;
  }

  public castTo<U>( concreteType: ConcreteType<U> ): BufferSlot<U> {
    const slot = new BufferSlot<U>( concreteType );

    this.bufferSlotSlices.push( new BufferSlotSlice( slot, 0 ) );

    return slot;
  }
}
alpenglow.register( 'BufferSlot', BufferSlot );