// Copyright 2023-2024, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import IntentionalAny from '../../../../phet-core/js/types/IntentionalAny.js';
import { alpenglow, BufferSlot } from '../../imports.js';

export default class BufferSlotSlice {
  public constructor(
    public readonly bufferSlot: BufferSlot<IntentionalAny>,
    public readonly offset: number
  ) {}
}
alpenglow.register( 'BufferSlotSlice', BufferSlotSlice );