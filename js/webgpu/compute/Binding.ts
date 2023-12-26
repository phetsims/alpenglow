// Copyright 2023, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BindingLocation, BindingType, BufferBindingType, ConcreteBufferSlot, ResourceSlot, StorageTextureBindingType, WGSLModuleDeclarations, WGSLVariableName } from '../../imports.js';

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

  public getWGSLDeclaration( name: WGSLVariableName ): WGSLModuleDeclarations {
    // TODO: typing improvements here? This isn't the best code
    if ( this.bindingType instanceof BufferBindingType && this.slot instanceof ConcreteBufferSlot ) {
      const varType = this.bindingType.type === 'uniform' ? 'uniform' : `storage, ${this.bindingType.type === 'read-only-storage' ? 'read' : 'read_write'}`;
      return `
        ${this.location.getWGSLAnnotation()}
        var<${varType}> ${name}: ${this.slot.concreteType.valueType};
      `;
    }
    else if ( this.bindingType instanceof StorageTextureBindingType ) {
      const access = {
        'write-only': 'write',
        'read-only': 'read',
        'read-write': 'read_write'
      }[ this.bindingType.access ];
      return `
        var ${name}: texture_storage_2d<${this.bindingType.format}, ${access}>;
      `;
    }
    else {
      throw new Error( 'TODO: either mismatched binding/slot, or unimplemented type (Texture?)' );
    }
  }
}
alpenglow.register( 'Binding', Binding );
