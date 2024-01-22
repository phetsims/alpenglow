// Copyright 2023, University of Colorado Boulder

/**
 * Support for code where we sometimes want an if-statement, and sometimes we don't.
 *
 * E.g. conditional_if( null, 'was_truthy();', 'was_falsy();' ) will return:
 *  was_truthy();
 *
 * E.g. conditional_if( is_truthy, 'was_truthy()', 'was_falsy()' ) will return:
 *  if ( is_truthy ) {
 *    was_truthy()
 *  }
 *  else {
 *    was_falsy()
 *  }
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, wgsl, WGSLExpressionBool, WGSLStatements } from '../../../imports.js';

const conditionalIfWGSL = (
  // null | string (expr:bool) - if null, trueStatements will be executed. If non-null, it will create an if(else)
  optionalConditional: WGSLExpressionBool | null,

  trueStatements: WGSLStatements,
  falseStatements: WGSLStatements | null = null
): WGSLStatements => {
  if ( optionalConditional === null ) {
    return trueStatements;
  }
  else {
    return wgsl`
      if ( ${optionalConditional} ) {
        ${trueStatements}
      }
      ${falseStatements !== null ? wgsl`
        else {
          ${falseStatements}
        }
      ` : wgsl``}
    `;
  }
};

export default conditionalIfWGSL;

alpenglow.register( 'conditionalIfWGSL', conditionalIfWGSL );
