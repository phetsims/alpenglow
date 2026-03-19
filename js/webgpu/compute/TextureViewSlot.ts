// Copyright 2023-2026, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import { ResourceSlot } from './ResourceSlot.js';

export class TextureViewSlot extends ResourceSlot {
  public toDebugString(): string {
    return `TextureViewSlot[#${this.id}]`;
  }
}
