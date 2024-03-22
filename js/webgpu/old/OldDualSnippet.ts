// Copyright 2023, University of Colorado Boulder

/**
 * Like Snippet, but designed for code where bindings are declared at a certain point, so it will contain both a
 * "before" and "after" section (for before and after where the bindings are declared). Thus code in the "after"
 * section CAN reference bindings, and should note the names they expect.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow } from '../../imports.js';

export type OldDualSnippetSource = ( includesMap: Record<string, unknown> ) => {
  before: string;
  after: string;
  imports: OldDualSnippetSource[];
  // TODO: add bindings here!
};

let globalSnippetIdCounter = 0;

export default class OldDualSnippet {

  private readonly id: number = globalSnippetIdCounter++;

  /**
   * Represents a piece of shader code with dependencies on other snippets. Supports serialization of only the
   * code that is needed.
   */
  public constructor(
    private readonly beforeSource: string,
    private readonly afterSource: string,
    private readonly dependencies: OldDualSnippet[] = []
  ) {}

  public static fromSource(
    source: OldDualSnippetSource,
    options: Record<string, unknown> = {},
    sourceToSnippetMap: Map<OldDualSnippetSource, OldDualSnippet> = new Map<OldDualSnippetSource, OldDualSnippet>()
  ): OldDualSnippet {
    if ( sourceToSnippetMap.has( source ) ) {
      return sourceToSnippetMap.get( source )!;
    }

    const resolvedSource = source( options );

    const dependencies = resolvedSource.imports.map( importSource => OldDualSnippet.fromSource( importSource, options, sourceToSnippetMap ) );

    const snippet = new OldDualSnippet( resolvedSource.before, resolvedSource.after, dependencies );
    sourceToSnippetMap.set( source, snippet );

    return snippet;
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

alpenglow.register( 'OldDualSnippet', OldDualSnippet );