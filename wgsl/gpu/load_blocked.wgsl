// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./unroll

${template( ( {
  value,
  load,
  identity,
  combine,
  grainSize,
  inputSizeString = null
} ) => `
  let base_blocked_index = ${u32( grainSize )} * global_id.x;
  var ${value} = ${
    inputSizeString === null ?
      load( `base_blocked_index` ) :
      `select( ${identity}, ${load( `base_blocked_index` )}, base_blocked_index < ${inputSizeString} )`
  };

  // TODO: consider nesting?
  ${unroll( 1, grainSize, i => `
    ${value} = ${
      combine(
        value,
        inputSizeString === null ?
          load( `base_blocked_index + ${i}` ) :
          `select( ${identity}, ${load( `base_blocked_index + ${i}` )}, base_blocked_index + ${i} < ${inputSizeString} )`
      )
    };
  ` )}
` )}
