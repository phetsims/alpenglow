// Copyright 2023, University of Colorado Boulder

/**
 * Stores multiple deduplicated WGSL module-level declarations in a way that can be passed through during WGSL
 * generation.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, Binding, BufferSlot, getArrayType, getCastedType, PipelineLayout, ResourceSlot, U32Type, WGSLModuleDeclarations, WGSLVariableName } from '../../imports.js';

export default class WGSLContext {
  private readonly declarations: WGSLInternalDeclaration[] = [];
  private readonly bindings: Binding[] = [];

  public constructor(
    public readonly shaderName: string,
    public readonly pipelineLayout: PipelineLayout,
    public readonly log: boolean
  ) {}

  // TODO: oh no, we need to put the atomic in here(!)
  // TODO: Or actually, just an ability to put structs of arbitrary types in ConcreteTypes
  public static readonly LOG_BUFFER_SLOT = new BufferSlot( getCastedType( getArrayType( U32Type, 2 << 22, 0 ), context => {
    context.add( '_Log', `
      struct _Log {
        next_space: atomic<u32>,
        data: array<u32>
      };
    ` );

    return '_Log';
  } ) );

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

      this.add( name, binding.getWGSLDeclaration( this, name ) );
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
