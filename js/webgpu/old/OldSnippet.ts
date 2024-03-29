// Copyright 2023-2024, University of Colorado Boulder

/**
 * Contains an import-style snippet of shader code, with dependencies on other snippets.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow } from '../../imports.js';

let globalSnippetIdCounter = 0;

export default class OldSnippet {

  private readonly id: number = globalSnippetIdCounter++;

  /**
   * Represents a piece of shader code with dependencies on other snippets. Supports serialization of only the
   * code that is needed.
   *
   * const a = new Snippet( 'A' )
   * const b = new Snippet( 'B', [a] )
   * const c = new Snippet( 'C', [a] )
   * const d = new Snippet( 'D', [b,c] )
   * d.toString() => "ABCD"
   * b.toString() => "AB"
   * c.toString() => "AC"
   */
  public constructor( private readonly source: string, private readonly dependencies: OldSnippet[] = [] ) {}

  /**
   * Assuming no circular dependencies, this returns the entire required subprogram as a string.
   * usedSnippets is used for internal use, just call toString().
   *
   * @param [usedSnippets] - Optional map from snippet ID => whether it was used.
   */
  public toString( usedSnippets: Record<number, boolean> = {} ): string {
    let result = '';

    // if we have already been included, all of our dependencies have been included
    if ( usedSnippets[ this.id ] ) {
      return result;
    }

    if ( this.dependencies ) {
      for ( let i = 0; i < this.dependencies.length; i++ ) {
        result += this.dependencies[ i ].toString( usedSnippets );
      }
    }

    result += this.source;

    usedSnippets[ this.id ] = true;

    return result;
  }

  /**
   * Creates a snippet for a numeric constant from a given large-precision string.
   */
  public static numericConstant( name: string, value: string ): OldSnippet {
    // Match WebGL handling
    return new OldSnippet( `#define ${name} ${value.substring( 0, 33 )}\n` );
  }

  /**
   * Turns a number into a GLSL-compatible float literal.
   */
  public static toFloat( n: number ): string {
    const s = n.toString();
    return ( !s.includes( '.' ) && !s.includes( 'e' ) && !s.includes( 'E' ) ) ? ( s + '.0' ) : s;
  }
}

alpenglow.register( 'OldSnippet', OldSnippet );