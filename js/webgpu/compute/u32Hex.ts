// Copyright 2023-2025, University of Colorado Boulder

/**
 * Utility for converting a number into an unsigned 32-bit integer string (with hexadecimal)
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import { alpenglow } from '../../alpenglow.js';

export const u32Hex = ( n: number ): string => {
  assert && assert( Number.isInteger( n ) && n >= 0 && n < 2 ** 32, `Invalid u32 value: ${n}` );

  return `0x${( n >>> 0 ).toString( 16 )}u`;
};
alpenglow.register( 'u32Hex', u32Hex );