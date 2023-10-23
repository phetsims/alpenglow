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
  var base_striped_index = workgroup_id.x * ${u32( workgroupSize * grainSize )} + local_id.x;
  var ${value} = ${
    inputSizeString === null ?
      load( `base_striped_index` ) :
      `select( ${identity}, ${load( `base_striped_index` )}, base_striped_index < ${inputSizeString} )`
  };

  // TODO: consider nesting?
  ${unroll( 1, grainSize, i => `
    {
      let index = base_striped_index + ${i} * ${u32( workgroupSize )};
      ${value} = ${
        combine(
          value,
          inputSizeString === null ?
            load( `index` ) :
            `select( ${identity}, ${load( `index` )}, index < ${inputSizeString} )`
        )
      };
    }
  ` )}
` )}
