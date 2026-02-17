// Copyright 2023-2025, University of Colorado Boulder

/**
 * Utility for converting a number into a 32-bit float string.
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import { alpenglow } from '../../alpenglow.js';

export const f32 = ( n: number ): string => {
  assert && assert( Number.isFinite( n ), `Invalid f32 value: ${n}` );

  return `${n}f`;
};
alpenglow.register( 'f32', f32 );