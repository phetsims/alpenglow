// Copyright 2023, University of Colorado Boulder

/**
 * TODO: doc (it's one of the more important ones)
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
