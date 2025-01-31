// Copyright 2023-2025, University of Colorado Boulder

/**
 * Utility for converting a number into a signed 32-bit integer string (in hexadecimal)
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow } from '../../alpenglow.js';

export const i32Hex = ( n: number ): string => {
  assert && assert( Number.isInteger( n ) && n >= -( 2 ** 31 ) && n < 2 ** 31, `Invalid i32 value: ${n}` );

  return `0x${( n >> 0 ).toString( 16 )}i`;
};
alpenglow.register( 'i32Hex', i32Hex );