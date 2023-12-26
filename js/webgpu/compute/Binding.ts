// Copyright 2023, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BindingLocation, BindingType, BufferBindingType, ResourceSlot } from '../../imports.js';

export default class Binding {
  public constructor(
    public readonly location: BindingLocation,
    public readonly bindingType: BindingType,
    public readonly slot: ResourceSlot
  ) {}

  // @deprecated - from the old version TODO remove
  public getStorageAccess(): 'read' | 'read_write' {
    if ( this.bindingType instanceof BufferBindingType ) {
      return this.bindingType.type === 'read-only-storage' ? 'read' : 'read_write';
    }
    else {
      throw new Error( 'bad binding type' );
    }
  }
}
alpenglow.register( 'Binding', Binding );
