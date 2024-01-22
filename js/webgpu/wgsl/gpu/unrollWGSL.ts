// Copyright 2023, University of Colorado Boulder

/**
 * A template that unrolls a simple loop over a range of numbers.
 *
 * Supports both forward and backward iteration (start < end, or start > end).
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, wgslJoin, WGSLStatements } from '../../../imports.js';

const unrollWGSL = (
  start: number,
  end: number,
  callback: ( i: number, isFirst: boolean, isLast: boolean ) => WGSLStatements
): WGSLStatements => {
  return wgslJoin( '\n', _.range( start, end ).map( i => callback( i, i === start, i === end + ( start < end ? -1 : 1 ) ) ) );
};

export default unrollWGSL;

alpenglow.register( 'unrollWGSL', unrollWGSL );
