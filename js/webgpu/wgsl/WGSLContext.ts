// Copyright 2023, University of Colorado Boulder

/**
 * Stores multiple deduplicated WGSL module-level declarations in a way that can be passed through during WGSL
 * generation.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, Binding, BindingLocation, ConcreteBufferSlot, getArrayType, PipelineLayout, ResourceSlot, U32Type, WGSLModuleDeclarations, WGSLVariableName } from '../../imports.js';

export default class WGSLContext {
  private readonly declarations: WGSLInternalDeclaration[] = [];
  private readonly bindings: Binding[] = [];

  public constructor(
    public readonly shaderName: string,
    public readonly pipelineLayout: PipelineLayout,
    public readonly log: boolean
  ) {}

  // TODO: cleanup
  public static getLogBindingLocation(): BindingLocation {
    return new BindingLocation( 0, 64 );
  }

  // TODO: oh no, we need to put the atomic in here(!)
  // TODO: Or actually, just an ability to put structs of arbitrary types in ConcreteTypes
  public static readonly LOG_BUFFER_SLOT = new ConcreteBufferSlot( getArrayType( U32Type, 2 << 22, 0 ) );

  public add(
    name: string,
    declarations: WGSLModuleDeclarations
  ): void {
    if ( !this.declarations.some( declaration => declaration.name === name ) ) {
      this.declarations.push( new WGSLInternalDeclaration( name, declarations ) );
    }
  }

  public addSlot( name: WGSLVariableName, slot: ResourceSlot ): void {
    this.addBinding( name, this.pipelineLayout.getBindingFromSlot( slot ) );
  }

  public addBinding( name: WGSLVariableName, binding: Binding ): void {
    const hasBinding = this.bindings.includes( binding );
    const hasName = this.declarations.some( declaration => declaration.name === name );

    assert && assert( hasBinding === hasName );

    if ( !hasBinding ) {
      this.bindings.push( binding );

      this.add( name, binding.getWGSLDeclaration( name ) );
    }
  }

  public toString(): string {
    return this.declarations.map( declaration => declaration.declarations ).join( '\n' );
  }

  public with( callback: ( context: WGSLContext ) => WGSLModuleDeclarations ): this {
    const declarations = callback( this );

    this.add( 'main', declarations );

    // for chaining
    return this;
  }
}
alpenglow.register( 'WGSLContext', WGSLContext );

class WGSLInternalDeclaration {
  public constructor(
    public readonly name: string,
    public readonly declarations: WGSLModuleDeclarations
  ) {}
}
