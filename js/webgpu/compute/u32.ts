// Copyright 2023-2024, University of Colorado Boulder

/**
 * Utility for converting a number into an unsigned 32-bit integer string.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow } from '../../alpenglow.js';

export const u32 = ( n: number ): string => {
  assert && assert( Number.isInteger( n ) && n >= 0 && n < 2 ** 32, `Invalid u32 value: ${n}` );

  return `${n >>> 0}u`;
};
alpenglow.register( 'u32', u32 );