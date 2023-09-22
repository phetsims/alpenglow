// Copyright 2023, University of Colorado Boulder

/**
 * Like Snippet, but designed for code where bindings are declared at a certain point, so it will contain both a
 * "before" and "after" section (for before and after where the bindings are declared). Thus code in the "after"
 * section CAN reference bindings, and should note the names they expect.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow } from '../imports.js';

export type DualSnippetSource = ( includesMap: Record<string, boolean> ) => {
  before: string;
  after: string;
  imports: DualSnippetSource[];
};

let globalSnippetIdCounter = 0;

export default class DualSnippet {

  private readonly id: number = globalSnippetIdCounter++;

  /**
   * Represents a piece of shader code with dependencies on other snippets. Supports serialization of only the
   * code that is needed.
   */
  public constructor(
    private readonly beforeSource: string,
    private readonly afterSource: string,
    private readonly dependencies: DualSnippet[] = []
  ) {}

  public static fromSource( source: DualSnippetSource, includesMap: Record<string, boolean> = {} ): DualSnippet {
    const resolvedSource = source( includesMap );

    const dependencies = resolvedSource.imports.map( importSource => DualSnippet.fromSource( importSource, includesMap ) );

    return new DualSnippet( resolvedSource.before, resolvedSource.after, dependencies );
  }

  /**
   * Assuming no circular dependencies, this returns the entire required subprogram as a string.
   */
  public toString(): string {
    const { before, after } = this.toDualString( {} );
    return `${before}\n${after}`;
  }

  /**
   * @param usedSnippets - Optional map from snippet ID => whether it was used.
   */
  public toDualString( usedSnippets: Record<number, boolean> ): { before: string; after: string } {
    let before = '';
    let after = '';

    // if we have already been included, all of our dependencies have been included
    if ( usedSnippets[ this.id ] ) {
      return { before: before, after: after };
    }

    if ( this.dependencies ) {
      for ( let i = 0; i < this.dependencies.length; i++ ) {
        const { before: depBefore, after: depAfter } = this.dependencies[ i ].toDualString( usedSnippets );
        before += depBefore;
        after += depAfter;
      }
    }

    before += this.beforeSource;
    after += this.afterSource;

    usedSnippets[ this.id ] = true;

    return { before: before, after: after };
  }
}

alpenglow.register( 'DualSnippet', DualSnippet );
