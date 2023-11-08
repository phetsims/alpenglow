// Copyright 2023, University of Colorado Boulder

/**
 * A template that unrolls a simple loop over a range of numbers.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

${template( ( start, end, callback ) => _.range( start, end ).map( i => callback( i, i === start, i === end + ( start < end ? -1 : 1 ) ) ).join( '\n' ) )}
