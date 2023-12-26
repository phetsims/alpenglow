// Copyright 2023, University of Colorado Boulder

/**
 * Stores multiple deduplicated WGSL module-level declarations in a way that can be passed through during WGSL
 * generation.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, Binding, BindingLocation, WGSLModuleDeclarations, WGSLVariableName } from '../../imports.js';

export default class WGSLContext {
  private readonly declarations: WGSLInternalDeclaration[] = [];
  private readonly bindings: Binding[] = [];

  public constructor(
    public readonly shaderName: string,
    public readonly log: boolean
  ) {}

  // TODO: cleanup
  public static getLogBindingLocation(): BindingLocation {
    return new BindingLocation( 0, 64 );
  }

  public add(
    name: string,
    declarations: WGSLModuleDeclarations
  ): void {
    if ( !this.declarations.some( declaration => declaration.name === name ) ) {
      this.declarations.push( new WGSLInternalDeclaration( name, declarations ) );
    }
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
