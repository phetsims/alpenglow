// Copyright 2023, University of Colorado Boulder

/**
 * A simple unrolled loop that provides both a "blocked" and "striped" (coalesced) index for each iteration.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./conditional_if
#import ./unroll

${template( ( {
  workgroupSize, // number
  grainSize, // number
  length, // null | expression: u32
  callback, // ( localIndex, dataIndex ) => void  (statement)
} ) => `
  ${unroll( 0, grainSize, i => `
    {
      let coalesced_local_index = ${u32( i * workgroupSize )} + local_id.x;
      let coalesced_data_index = workgroup_id.x * ${u32( workgroupSize * grainSize )} + coalesced_local_index;
      ${conditional_if( length ? `coalesced_data_index < ${length}` : null, `
        ${callback( `coalesced_local_index`, `coalesced_data_index` )}
      ` )}
    }
  ` )}
` )}
