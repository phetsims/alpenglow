// Copyright 2023-2024, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, ResourceSlot } from '../../imports.js';

export default class TextureViewSlot extends ResourceSlot {
  public toDebugString(): string {
    return `TextureViewSlot[#${this.id}]`;
  }
}
alpenglow.register( 'TextureViewSlot', TextureViewSlot );