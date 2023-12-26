// Copyright 2023, University of Colorado Boulder

/**
 * Utility for converting a number into a 32-bit float string.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow } from '../../imports.js';

const f32 = ( n: number ): string => {
  assert && assert( Number.isFinite( n ), `Invalid f32 value: ${n}` );

  return `${n}f`;
};

export default f32;

alpenglow.register( 'f32', f32 );
