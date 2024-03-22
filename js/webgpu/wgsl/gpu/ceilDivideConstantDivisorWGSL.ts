// Copyright 2023-2024, University of Colorado Boulder

/**
 * See https://stackoverflow.com/questions/2745074/fast-ceiling-of-an-integer-division-in-c-c
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, u32S, wgsl, WGSLExpressionU32 } from '../../../imports.js';

// Math.ceil( x / y ), but with unsigned numbers
const ceilDivideConstantDivisorWGSL = (
  x: WGSLExpressionU32,
  y: number
): WGSLExpressionU32 => {
  if ( y === 1 ) {
    return x;
  }
  else {
    return wgsl`( ( ( ${x} ) + ${u32S( y - 1 )} ) / ${u32S( y )} )`;
  }
};

export default ceilDivideConstantDivisorWGSL;

alpenglow.register( 'ceilDivideConstantDivisorWGSL', ceilDivideConstantDivisorWGSL );