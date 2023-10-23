// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./unroll

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

  // TODO: consider nesting?
  ${unroll( 1, grainSize, i => `
    ${value} = ${
      combine(
        value,
        inputSizeString === null ?
          `input[ blockedBaseIndex + ${i} ]` :
          `select( ${identity}, input[ blockedBaseIndex + ${i} ], blockedBaseIndex + ${i} < ${inputSizeString} )`
      )
    };
  ` )}
` )}
