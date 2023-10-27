// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./unroll

${template( ( {
  value,
  valueType,
  load,
  identity,
  combine,
  workgroupSize,
  grainSize,
  inputSizeString = null
} ) => `
  var ${value}: ${valueType};
  {
    var base_striped_index = workgroup_id.x * ${u32( workgroupSize * grainSize )} + local_id.x;
    ${value} = ${
      inputSizeString === null ?
        load( `base_striped_index` ) :
        `select( ${identity}, ${load( `base_striped_index` )}, base_striped_index < ${inputSizeString} )`
    };

    // TODO: consider nesting?
    ${unroll( 1, grainSize, i => `
      {
        let index = base_striped_index + ${u32( i * workgroupSize )};
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
  }
` )}
