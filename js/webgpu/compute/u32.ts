// Copyright 2023-2026, University of Colorado Boulder

/**
 * Utility for converting a number into an unsigned 32-bit integer string.
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

export const u32 = ( n: number ): string => {
  assert && assert( Number.isInteger( n ) && n >= 0 && n < 2 ** 32, `Invalid u32 value: ${n}` );

  return `${n >>> 0}u`;
};
