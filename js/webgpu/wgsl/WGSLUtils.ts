// Copyright 2023, University of Colorado Boulder

/**
 * Represents a compiled shader and associated data.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, WGSLExpressionU32, WGSLModuleDeclarations } from '../../imports.js';

export type GlobalIndexable = {
  // expression: u32 (the global index of the thread) - overrideable so we can run multiple smaller loads in the same
  // workgroup if ever desired
  globalIndex?: WGSLExpressionU32;
};
export const GLOBAL_INDEXABLE_DEFAULTS = {
  globalIndex: 'global_id.x'
} as const;

export type WorkgroupIndexable = {
  // expression: u32 (the index of the workgroup) - overrideable so we can run multiple smaller loads in the same
  // workgroup if ever desired
  workgroupIndex?: WGSLExpressionU32;
};
export const WORKGROUP_INDEXABLE_DEFAULTS = {
  workgroupIndex: 'workgroup_id.x'
} as const;

export type LocalIndexable = {
  // expression: u32 (the index of the thread within the workgroup) - overrideable so we can run multiple smaller loads
  // in the same workgroup if ever desired
  localIndex?: WGSLExpressionU32;
};
export const LOCAL_INDEXABLE_DEFAULTS = {
  localIndex: 'local_id.x'
} as const;

export const partialWGSLBeautify = ( wgsl: WGSLModuleDeclarations ): WGSLModuleDeclarations => {
  const lines = wgsl.split( '\n' ).filter( s => s.trim().length > 0 );
  let count = 0;
  let beautified = '';
  for ( let i = 0; i < lines.length; i++ ) {
    const line = lines[ i ].trim();

    // better version of indentation for ( and {
    if ( line.startsWith( '}' ) || line.startsWith( ')' ) ) {
      count--;
    }
    beautified += `${'  '.repeat( Math.max( count, 0 ) )}${line}\n`;
    if ( line.endsWith( '{' ) || line.endsWith( '(' ) ) {
      count++;
    }
  }
  return beautified;
};

alpenglow.register( 'partialWGSLBeautify', partialWGSLBeautify );

export const addLineNumbers = ( wgsl: WGSLModuleDeclarations ): string => {
  return wgsl.split( '\n' ).map( ( s, i ) => `${i + 1} ${s}` ).join( '\n' );
};

alpenglow.register( 'addLineNumbers', addLineNumbers );

/**
 * Strips comments from a WGSL string (in an opinionated way, to potentially leave some in for help with debugging).
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */
export const stripWGSLComments = (
  str: WGSLModuleDeclarations,
  allComments = true // if false, we'll leave things starting with /** and ending with **/ (for our own comments)
): WGSLModuleDeclarations => {
  return str.replace( allComments ? /\/\**?\*\//g : /\/\*[^*]*?[^*]\*\//g, '' ).replace( /\r\n/g, '\n' ).split( '\n' ).map( line => {
    const index = line.indexOf( '//' );
    return index >= 0 ? line.substring( 0, index ) : line;
  } ).join( '\n' );
};

alpenglow.register( 'stripWGSLComments', stripWGSLComments );
