// Copyright 2023, University of Colorado Boulder

/**
 * Utility for converting a number into a signed 32-bit integer string.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow } from '../imports.js';

const i32 = ( n: number ): string => {
  assert && assert( Number.isInteger( n ) && n >= -( 2 ** 31 ) && n < 2 ** 31, `Invalid i32 value: ${n}` );

  return `${n >> 0}i`;
};

export default i32;

alpenglow.register( 'i32', i32 );
