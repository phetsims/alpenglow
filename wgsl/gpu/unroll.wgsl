// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

${template( ( start, end, callback ) => _.range( start, end ).map( i => callback( i, i === start, i === end - 1 ) ).join( '\n' ) )}
