// Copyright 2023-2025, University of Colorado Boulder

/**
 * Utility for converting a number into a signed 32-bit integer string.
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import { alpenglow } from '../../alpenglow.js';

export const i32 = ( n: number ): string => {
  assert && assert( Number.isInteger( n ) && n >= -( 2 ** 31 ) && n < 2 ** 31, `Invalid i32 value: ${n}` );

  return `${n >> 0}i`;
};
alpenglow.register( 'i32', i32 );