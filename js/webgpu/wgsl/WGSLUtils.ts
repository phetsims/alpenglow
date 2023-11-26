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
