// Copyright 2023, University of Colorado Boulder

/**
 * Utility for converting a number into an unsigned 32-bit integer string (with hexadecimal)
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow } from '../imports.js';

const u32Hex = ( n: number ): string => {
  assert && assert( Number.isInteger( n ) && n >= 0 && n < 2 ** 32, `Invalid u32 value: ${n}` );

  return `0x${( n >>> 0 ).toString( 16 )}u`;
};

export default u32Hex;

alpenglow.register( 'u32Hex', u32Hex );
