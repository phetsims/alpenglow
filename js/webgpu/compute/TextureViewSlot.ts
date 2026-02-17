// Copyright 2023-2025, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import { alpenglow } from '../../alpenglow.js';
import { ResourceSlot } from './ResourceSlot.js';

export class TextureViewSlot extends ResourceSlot {
  public toDebugString(): string {
    return `TextureViewSlot[#${this.id}]`;
  }
}
alpenglow.register( 'TextureViewSlot', TextureViewSlot );