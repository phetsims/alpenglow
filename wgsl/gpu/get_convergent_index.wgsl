// Copyright 2023, University of Colorado Boulder

/**
 * Returns the bit-reversed version of the given value, such that it is sufficient for the convergent-indexed reduce.
 *
 * NOTE: This operation is reversible, so there is no to/from equivalent
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./unroll

${template( ( {
  i, // expr: u32
  size, // number
} ) => {
  assert && assert( Number.isInteger( Math.log2( size ) ) );

  return `( reverseBits( ${expr} ) >> ${u32( 32 - Math.log2( size ) )} )`;
} )}
