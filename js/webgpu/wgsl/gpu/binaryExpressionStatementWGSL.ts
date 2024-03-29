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

import { alpenglow, wgsl, WGSLBinaryExpression, WGSLBinaryStatements, WGSLExpression, WGSLStatements, WGSLVariableName } from '../../../imports.js';

const binaryExpressionStatementWGSL = (
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

export default binaryExpressionStatementWGSL;

alpenglow.register( 'binaryExpressionStatementWGSL', binaryExpressionStatementWGSL );