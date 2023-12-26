// Copyright 2023, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BufferSlotSlice, ConcreteType, ResourceSlot } from '../../imports.js';

export default class BufferSlot<T = unknown> extends ResourceSlot {
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

  public toString(): string {
    return `BufferSlot(${this.size})`;
  }
}
alpenglow.register( 'BufferSlot', BufferSlot );
