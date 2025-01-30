// Copyright 2023-2024, University of Colorado Boulder

/**
 * Utility for converting a number into a decimal string for WGSL
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow } from '../../alpenglow.js';

export const decimal = ( n: number ): string => {
  assert && assert( Number.isInteger( n ) && n >= 0 && n < 2 ** 32, `Invalid decimal value: ${n}` );

  return `${n >>> 0}`;
};
alpenglow.register( 'decimal', decimal );