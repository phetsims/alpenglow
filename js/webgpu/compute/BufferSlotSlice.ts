// Copyright 2023, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BufferSlot } from '../../imports.js';

export default class BufferSlotSlice {
  public constructor(
    public readonly bufferSlot: BufferSlot,
    public readonly offset: number
  ) {}
}
alpenglow.register( 'BufferSlotSlice', BufferSlotSlice );
