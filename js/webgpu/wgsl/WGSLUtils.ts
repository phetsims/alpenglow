// Copyright 2023-2024, University of Colorado Boulder

/**
 * Represents a compiled shader and associated data.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, wgsl, WGSLExpressionU32 } from '../../imports.js';

export type WorkgroupSizable = {
  // the number of threads running this command
  workgroupSize: number;
};

export type GrainSizable = {
  // the number of elements each thread should process
  grainSize: number;
};

export type RakedSizable = WorkgroupSizable & GrainSizable;

export type GlobalIndexable = {
  // expression: u32 (the global index of the thread) - overrideable so we can run multiple smaller loads in the same
  // workgroup if ever desired
  globalIndex?: WGSLExpressionU32;
};
export const GLOBAL_INDEXABLE_DEFAULTS = {
  globalIndex: wgsl`global_id.x`
} as const;

export type WorkgroupIndexable = {
  // expression: u32 (the index of the workgroup) - overrideable so we can run multiple smaller loads in the same
  // workgroup if ever desired
  workgroupIndex?: WGSLExpressionU32;
};
export const WORKGROUP_INDEXABLE_DEFAULTS = {
  workgroupIndex: wgsl`workgroup_id.x`
} as const;

export type LocalIndexable = {
  // expression: u32 (the index of the thread within the workgroup) - overrideable so we can run multiple smaller loads
  // in the same workgroup if ever desired
  localIndex?: WGSLExpressionU32;
};
export const LOCAL_INDEXABLE_DEFAULTS = {
  localIndex: wgsl`local_id.x`
} as const;

export type OptionalLengthExpressionable = {
  // if provided, it will enable range checks (based on whatever input order of the data was given)
  lengthExpression?: WGSLExpressionU32 | null;
};
export const OPTIONAL_LENGTH_EXPRESSIONABLE_DEFAULTS = {
  lengthExpression: null
} as const;

export const partialWGSLBeautify = ( wgsl: string ): string => {
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

export const addLineNumbers = ( wgsl: string ): string => {
  return wgsl.split( '\n' ).map( ( s, i ) => `${i + 1} ${s}` ).join( '\n' );
};

alpenglow.register( 'addLineNumbers', addLineNumbers );

/**
 * Strips comments from a WGSL string (in an opinionated way, to potentially leave some in for help with debugging).
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */
export const stripWGSLComments = (
  str: string,
  allComments = true // if false, we'll leave things starting with /** and ending with **/ (for our own comments)
): string => {
  return str.replace( allComments ? /\/\**?\*\//g : /\/\*[^*]*?[^*]\*\//g, '' ).replace( /\r\n/g, '\n' ).split( '\n' ).map( line => {
    const index = line.indexOf( '//' );
    return index >= 0 ? line.substring( 0, index ) : line;
  } ).join( '\n' );
};

alpenglow.register( 'stripWGSLComments', stripWGSLComments );
