// Copyright 2023, University of Colorado Boulder

/**
 * Optimized multiplication by a constant (so we can factor out simple cases, in case the compiler doesn't)
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

${template( ( {
  expr, // expression: u32
  constant, // number
} ) => {
  assert && assert( constant >= 0 );
  if ( constant === 0 ) {
    return '0u';
  }
  else if ( constant === 1 ) {
    return expr;
  }
  else if ( Math.isInteger( Math.log2( constant ) ) ) {
    return `( ${expr} ) >> ${u32( Math.log2( constant ) )}`;
  }
  else {
    return `( ${expr} ) * ${u32( constant )}`;
  }
} )}
