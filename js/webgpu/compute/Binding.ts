// Copyright 2023, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BindingLocation, BindingType, BufferBindingType, BufferSlot, ResourceSlot, StorageTextureBindingType, wgsl, WGSLModuleDeclarations, wgslString } from '../../imports.js';

export default class Binding {
  public constructor(
    public readonly location: BindingLocation,
    public readonly bindingType: BindingType,
    public readonly slot: ResourceSlot
  ) {}

  public getWGSLDeclaration( name: string ): WGSLModuleDeclarations {
    // TODO: typing improvements here? This isn't the best code
    if ( this.bindingType instanceof BufferBindingType && this.slot instanceof BufferSlot ) {
      const varType = this.bindingType.type === 'uniform' ? wgsl`uniform` : wgsl`storage, ${this.bindingType.type === 'read-only-storage' ? wgsl`read` : wgsl`read_write`}`;
      return wgsl`
        ${this.location.getWGSLAnnotation()}
        var<${varType}> ${wgslString( name )}: ${this.slot.concreteType.valueType};
      `;
    }
    else if ( this.bindingType instanceof StorageTextureBindingType ) {
      const access = {
        'write-only': 'write',
        'read-only': 'read',
        'read-write': 'read_write'
      }[ this.bindingType.access ];
      return wgsl`
        var ${wgslString( name )}: texture_storage_2d<${wgslString( this.bindingType.format )}, ${wgslString( access )}>;
      `;
    }
    else {
      throw new Error( 'TODO: either mismatched binding/slot, or unimplemented type (Texture?)' );
    }
  }
}
alpenglow.register( 'Binding', Binding );
