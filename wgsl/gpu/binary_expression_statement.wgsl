// Copyright 2023, University of Colorado Boulder

/**
 * A helper for cases where we just want to assign the resut of an expression/statements to a variable.
 *
 * TODO: replace usages with this!
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

${template( (
  // the variable name we're assigning to
  value,

  // null | expression
  expression,

  // null | statements
  statements,

  // the first parameter
  a,

  // the second parameter
  b,
) => {
  assert && assert( a );
  assert && assert( b );

  if ( expression ) {
    return `${value} = ${expression( a, b )};`;
  }
  else if ( statements ) {
    return `
      ${statements( value, a, b )}
    `;
  }
} )}
