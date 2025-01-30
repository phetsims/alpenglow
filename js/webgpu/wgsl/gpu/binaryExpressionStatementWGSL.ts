// Copyright 2023-2024, University of Colorado Boulder

/**
 * A helper for cases where we just want to assign the result of an expression/statements to a variable.
 *
 * TODO: Come up with a better TS solution to these
 *
 * TODO: We could just... not use this (statements), rely on function calls
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow } from '../../../alpenglow.js';
import { wgsl, WGSLBinaryExpression, WGSLExpression, WGSLStatements, WGSLVariableName } from '../WGSLString.js';
import { WGSLBinaryStatements } from '../../compute/ConcreteType.js';

export const binaryExpressionStatementWGSL = (
  value: WGSLVariableName,
  binaryExpression: WGSLBinaryExpression | null,
  binaryStatements: WGSLBinaryStatements | null,
  a: WGSLExpression,
  b: WGSLExpression
): WGSLStatements => {
  if ( binaryExpression ) {
    return wgsl`${value} = ${binaryExpression( a, b )};`;
  }
  else if ( binaryStatements ) {
    return wgsl`
      ${binaryStatements( value, a, b )}
    `;
  }
  else {
    throw new Error( 'Did not provide binaryExpression or binaryStatements' );
  }
};

alpenglow.register( 'binaryExpressionStatementWGSL', binaryExpressionStatementWGSL );