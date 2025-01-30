// Copyright 2023-2024, University of Colorado Boulder

/**
 * See https://stackoverflow.com/questions/2745074/fast-ceiling-of-an-integer-division-in-c-c
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow } from '../../../alpenglow.js';
import { wgsl, WGSLExpressionU32 } from '../WGSLString.js';

// Math.ceil( x / y ), but with unsigned numbers
export const ceilDivideWGSL = (
  x: WGSLExpressionU32,
  y: WGSLExpressionU32
): WGSLExpressionU32 => {
  return wgsl`( ( ( ${x} ) + ( ${y} ) - 1u ) / ( ${y} ) )`;
};

alpenglow.register( 'ceilDivideWGSL', ceilDivideWGSL );