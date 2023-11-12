// Copyright 2023, University of Colorado Boulder

/**
 * A test for atomic-only reduction
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./unroll

#option workgroupSize
#option grainSize
#option length
#option identity
#option valueType
#option atomicOperation
#option numAtomics
#option directAtomics

@group(0) @binding(0)
var<storage> input: array<${valueType}>;
@group(0) @binding(1)
var<storage, read_write> output: atomic<${valueType}>;

var<workgroup> scratch: array<atomic<${valueType}>, ${numAtomics}>;

#bindings

@compute @workgroup_size(${workgroupSize})
fn main(
  @builtin(global_invocation_id) global_id: vec3u,
  @builtin(local_invocation_id) local_id: vec3u,
  @builtin(workgroup_id) workgroup_id: vec3u
) {

  // We need to store the identity if it's not zero (because browsers will zero our atomics)
  ${identity === '0u' || identity === '0i' ? `` : `
    if ( local_id.x < ${u32( numAtomics )} ) {
      atomicStore( &scratch[ local_id.x ], ${identity} );
    }

    workgroupBarrier();
  `}

  let base_striped_index = workgroup_id.x * ${u32( workgroupSize * grainSize )} + local_id.x;
  ${unroll( 0, grainSize, i => `
    {
      let striped_index = base_striped_index + ${u32( i * workgroupSize )};
      ${length ? `
        // NOTE: only supporting blocked index order for now
        if ( striped_index < ${length} ) {
          ${atomicOperation}( &output, input[ striped_index ] );
        }
      ` : `
        ${atomicOperation}( &output, input[ striped_index ] );
      `}
    }
  ` )}

  workgroupBarrier();

  ${directAtomics ? `
    if ( local_id.x < ${u32( numAtomics )} ) {
      ${atomicOperation}( &output, atomicLoad( &scratch[ local_id.x ] ) );
    }
  ` : `
    ${numAtomics > 1 ? `
      if ( local_id.x > 0 && local_id.x < ${u32( numAtomics )} ) {
        ${atomicOperation}( &scratch[ 0u ], atomicLoad( &scratch[ local_id.x ] ) );
      }

      workgroupBarrier();
    ` : ``}

    if ( local_id.x == 0u ) {
      ${atomicOperation}( &output, atomicLoad( &scratch[ 0u ] ) );
    }
  `}
}
