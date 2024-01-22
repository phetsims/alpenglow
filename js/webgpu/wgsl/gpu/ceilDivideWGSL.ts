// Copyright 2023-2024, University of Colorado Boulder

/**
 * See https://stackoverflow.com/questions/2745074/fast-ceiling-of-an-integer-division-in-c-c
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, wgsl, WGSLExpressionU32 } from '../../../imports.js';

// Math.ceil( x / y ), but with unsigned numbers
const ceilDivideWGSL = (
  x: WGSLExpressionU32,
  y: WGSLExpressionU32
): WGSLExpressionU32 => {
  return wgsl`( ( ( ${x} ) + ( ${y} ) - 1u ) / ( ${y} ) )`;
};

export default ceilDivideWGSL;

alpenglow.register( 'ceilDivideWGSL', ceilDivideWGSL );
