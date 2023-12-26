// Copyright 2023, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BindingType, ResourceUsage, TextureViewSlot } from '../../imports.js';

export default class TextureViewUsage extends ResourceUsage {
  public constructor(
    public readonly textureViewSlot: TextureViewSlot,
    bindingType: BindingType
  ) {
    super( textureViewSlot, bindingType );
  }
}
alpenglow.register( 'TextureViewUsage', TextureViewUsage );
