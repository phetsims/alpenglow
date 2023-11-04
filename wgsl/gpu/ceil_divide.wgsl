// Copyright 2023, University of Colorado Boulder

/**
 * See https://stackoverflow.com/questions/2745074/fast-ceiling-of-an-integer-division-in-c-c
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

// Math.ceil( x / y ), but with unsigned numbers
${template( (
  x, // expr: u32
  y, // expr: u32
) => `( ( ( ${x} ) + ( ${y} ) - 1u ) / ( ${y} ) )` )}
