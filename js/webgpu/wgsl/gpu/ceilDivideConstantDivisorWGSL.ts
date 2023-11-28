// Copyright 2023, University of Colorado Boulder

/**
 * See https://stackoverflow.com/questions/2745074/fast-ceiling-of-an-integer-division-in-c-c
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, u32, WGSLExpressionU32 } from '../../../imports.js';

// Math.ceil( x / y ), but with unsigned numbers
const ceilDivideConstantDivisorWGSL = (
  x: WGSLExpressionU32,
  y: number
): string => {
  return `( ( ( ${x} ) + ${u32( y - 1 )} ) / ${u32( y )} )`;
};

export default ceilDivideConstantDivisorWGSL;

alpenglow.register( 'ceilDivideConstantDivisorWGSL', ceilDivideConstantDivisorWGSL );
