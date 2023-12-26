// Copyright 2023, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, ResourceSlot } from '../../imports.js';

export default class TextureViewSlot extends ResourceSlot {
  public toString(): string {
    return 'TextureViewSlot()';
  }
}
alpenglow.register( 'TextureViewSlot', TextureViewSlot );
