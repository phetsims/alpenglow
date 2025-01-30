// Copyright 2023-2024, University of Colorado Boulder

/**
 * A template that unrolls a simple loop over a range of numbers.
 *
 * Supports both forward and backward iteration (start < end, or start > end).
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow } from '../../../alpenglow.js';
import { wgslJoin, WGSLStatements } from '../WGSLString.js';

export const unrollWGSL = (
  start: number,
  end: number,
  callback: ( i: number, isFirst: boolean, isLast: boolean ) => WGSLStatements
): WGSLStatements => {
  return wgslJoin( '\n', _.range( start, end ).map( i => callback( i, i === start, i === end + ( start < end ? -1 : 1 ) ) ) );
};

alpenglow.register( 'unrollWGSL', unrollWGSL );