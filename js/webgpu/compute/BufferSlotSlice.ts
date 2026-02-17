// Copyright 2023-2025, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import IntentionalAny from '../../../../phet-core/js/types/IntentionalAny.js';
import { alpenglow } from '../../alpenglow.js';
import type { BufferSlot } from './BufferSlot.js';

export class BufferSlotSlice {
  public constructor(
    public readonly bufferSlot: BufferSlot<IntentionalAny>,
    public readonly offset: number
  ) {}
}
alpenglow.register( 'BufferSlotSlice', BufferSlotSlice );