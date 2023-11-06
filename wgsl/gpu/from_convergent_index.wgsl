// Copyright 2023, University of Colorado Boulder

/**
 * Converts an index from a convergent order to a normal (blocked) order. See get_convergent_index.js for more details.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./get_convergent_index

${template( ( {
  i, // expr: u32
  size, // number
} ) => {
  assert && assert( Number.isInteger( Math.log2( size ) ) );

  const convergentMask = size - 1;
  const outsideMask = 0xffffffff - convergentMask;

  return `( ( ${i} & ${u32( outsideMask )} ) | ${get_convergent_index( {
    i: `( ${i} & ${u32( convergentMask )} )`,
    size: size
  } )} )`;
} )}
