// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

${template( ( {
  value,
  identity,
  combine,
  grainSize,
  inputSizeString = null
} ) => `
  let blockedBaseIndex = ${u32( grainSize )} * global_id.x;
  var ${value} = ${
    inputSizeString === null ?
      `input[ blockedBaseIndex ]` :
      `select( ${identity}, input[ blockedBaseIndex ], blockedBaseIndex < ${inputSizeString} )`
  };
  // TODO: compute the maximum i value based on the inputSize (don't need further checks inside)
  // TODO: how to unroll? nested if statements? how can we do it without branches?
  for ( var i = 1u; i < ${u32( grainSize )}; i++ ) {
    ${value} = ${
      combine(
        value,
        inputSizeString === null ?
          `input[ blockedBaseIndex + i ]` :
          `select( ${identity}, input[ blockedBaseIndex + i ], blockedBaseIndex + i < ${inputSizeString} )`
      )
    };
  }
  // TODO: unroll these?
` )}
