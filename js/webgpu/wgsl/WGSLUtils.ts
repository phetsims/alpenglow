// Copyright 2023, University of Colorado Boulder

/**
 * Represents a compiled shader and associated data.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, WGSLModuleDeclarations } from '../../imports.js';

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
