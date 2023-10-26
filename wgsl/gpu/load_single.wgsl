// Copyright 2023, University of Colorado Boulder

/**
 * Load compatible with the other formats
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./unroll

${template( ( {
  value,
  load,
  identity,
  inputSizeString = null
} ) => `
  var ${value} = ${
    inputSizeString === null ?
      load( `base_blocked_index` ) :
      `select( ${identity}, ${load( `${u32( grainSize )} * global_id.x` )}, ${u32( grainSize )} * global_id.x < ${inputSizeString} )`
  };
` )}
