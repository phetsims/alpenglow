// Copyright 2023, University of Colorado Boulder

/**
 * Stores multiple deduplicated WGSL module-level declarations in a way that can be passed through during WGSL
 * generation.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, WGSLModuleDeclarations } from '../../imports.js';

export default class WGSLContext {
  private readonly declarations: WGSLInternalDeclaration[] = [];

  public constructor(
    public readonly shaderName: string,
    public readonly log: boolean
  ) {}

  public getLogBinding(): number {
    // TODO actually improve binding system
    return 64;
  }

  public add(
    name: string,
    declarations: WGSLModuleDeclarations
  ): void {
    if ( !this.declarations.some( declaration => declaration.name === name ) ) {
      this.declarations.push( new WGSLInternalDeclaration( name, declarations ) );
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
