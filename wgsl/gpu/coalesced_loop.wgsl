// Copyright 2023, University of Colorado Boulder

/**
 * TODO: docs
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./unroll

${template( ( {
  workgroupSize, // number
  grainSize, // number
  length, // expression: u32
  callback, // ( localIndex, dataIndex ) => void  (statement)
} ) => `
  ${unroll( 0, grainSize, i => `
    {
      let coalesced_local_index = ${u32( i * workgroupSize )} + local_id.x;
      let coalesced_data_index = workgroup_id.x * ${u32( workgroupSize * grainSize )} + coalesced_local_index;
      if ( coalesced_data_index < ${length} ) {
        ${callback( `coalesced_local_index`, `coalesced_data_index` )}
      }
    }
  ` )}
` )}
