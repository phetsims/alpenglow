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

#import ./unroll

${template( (
  // null | string (expr:bool) - if null, trueStatements will be executed. If non-null, it will create an if(else)
  optionalConditional,

  // string (statements)
  trueStatements,

  // null | string (statements)
  falseStatements = null
) => {
  if ( optionalConditional === null ) {
    return trueStatements;
  }
  else {
    return `
      if ( ${optionalConditional} ) {
        ${trueStatements}
      }
      ${falseStatements !== null ? `
        else {
          ${falseStatements}
        }
      ` : ``}
    `;
  }
} )}
