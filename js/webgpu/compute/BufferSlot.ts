// Copyright 2023, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BufferSlotSlice, ResourceSlot } from '../../imports.js';

// TODO: Is BufferSlot worth the separation? Just have ConcreteBufferSlot?  YEAH just move BufferSlot things into here, we need the types in the WGSLContext
export default class BufferSlot extends ResourceSlot {
  public readonly bufferSlotSlices: BufferSlotSlice[] = [];

  public constructor(
    public readonly size: number // bytes
  ) {
    super();
  }

  public hasChildSlot( slot: BufferSlot ): boolean {
    return this.bufferSlotSlices.some( slice => slice.bufferSlot === slot );
  }

  public toString(): string {
    return `BufferSlot(${this.size})`;
  }
}
alpenglow.register( 'BufferSlot', BufferSlot );
