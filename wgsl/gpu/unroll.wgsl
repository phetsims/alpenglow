// Copyright 2023, University of Colorado Boulder

/**
 * A template that unrolls a simple loop over a range of numbers.
 *
 * Supports both forward and backward iteration (start < end, or start > end).
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

${template( (
  // number
  start,

  // number
  end,

  // ( index: number, isFirst: boolean, isLast: boolean ) => string (statements)
  callback
) => _.range( start, end ).map( i => callback( i, i === start, i === end + ( start < end ? -1 : 1 ) ) ).join( '\n' ) )}
