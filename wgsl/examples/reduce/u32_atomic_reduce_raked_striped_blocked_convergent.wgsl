// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ../../gpu/reduce_convergent
#import ../../gpu/load_striped_blocked

#option workgroupSize
#option grainSize
#option inputSize

#option identity
#option combine

@group(0) @binding(0)
var<storage> input: array<u32>;
@group(0) @binding(1)
var<storage, read_write> output: atomic<u32>;

var<workgroup> scratch: array<u32, ${workgroupSize}>;

#bindings

@compute @workgroup_size(${workgroupSize})
fn main(
  @builtin(global_invocation_id) global_id: vec3u,
  @builtin(local_invocation_id) local_id: vec3u,
  @builtin(workgroup_id) workgroup_id: vec3u
) {
  ${load_striped_blocked( {
    value: `value`,
    valueType: 'u32',
    load: i => `input[ ${i} ]`,
    identity: identity,
    combine: combine,
    workgroupSize: workgroupSize,
    grainSize: grainSize,
    inputSizeString: u32( inputSize )
  } )}

  ${reduce_convergent( {
    value: 'value',
    scratch: 'scratch',
    workgroupSize: workgroupSize,
    identity: identity,
    combine: combine
  } )}

  if ( local_id.x == 0u ) {
    atomicAdd( &output, value );
  }
}
