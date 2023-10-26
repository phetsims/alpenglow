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
  workgroupSize,
  grainSize,
  inputSizeString = null
} ) => `
  // TODO: Figure out a good solution for variable names. We'll want to be able to run this twice, and it is
  // TODO: exposing these names
  ${
    inputSizeString === null ?
      `
        let striped_base = workgroup_id.x * ${u32( workgroupSize * grainSize )} + local_id.x;
      ` : `
        let workgroup_base = workgroup_id.x * ${u32( workgroupSize * grainSize )};
        let striped_base = workgroup_base + local_id.x;
        let blocked_base = workgroup_base + local_id.x * ${u32( grainSize )};
      `
  }
  var ${value} = ${
    inputSizeString === null ?
      load( `striped_base` ) :
      `select( ${identity}, ${load( `striped_base` )}, blocked_base < ${inputSizeString} )`
  };

  // TODO: consider nesting?
  ${unroll( 1, grainSize, i => `
    ${value} = ${
      combine(
        value,
        inputSizeString === null ?
          load( `striped_base + ${u32( i * workgroupSize )}` ) :
          `select( ${identity}, ${load( `striped_base + ${u32( i * workgroupSize )}` )}, blocked_base + ${i} < ${inputSizeString} )`
      )
    };
  ` )}
` )}
