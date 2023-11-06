// Copyright 2023, University of Colorado Boulder

/**
 * Converts an index from a normal (blocked) order to a convergent order. See get_convergent_index.js for more details.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./from_convergent_index

${template( ( {
  i, // expr: u32
  size, // number
} ) => from_convergent_index( { i, size } ) )}
