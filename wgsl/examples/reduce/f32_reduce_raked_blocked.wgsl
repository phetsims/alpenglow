// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ../../gpu/reduce
#import ../../gpu/reduced_load

#option workgroupSize
#option grainSize
#option inputSize

#option identity
#option combine

@group(0) @binding(0)
var<storage> input: array<f32>;
@group(0) @binding(1)
var<storage, read_write> output: array<f32>;

var<workgroup> scratch: array<f32, ${workgroupSize}>;

#bindings

@compute @workgroup_size(${workgroupSize})
fn main(
  @builtin(global_invocation_id) global_id: vec3u,
  @builtin(local_invocation_id) local_id: vec3u,
  @builtin(workgroup_id) workgroup_id: vec3u
) {
  ${reduced_load( {
    value: `value`,
    valueType: 'f32',
    loadExpression: i => `input[ ${i} ]`,
    identity: identity,
    combineExpression: combine,
    workgroupSize: workgroupSize,
    grainSize: grainSize,
    length: u32( inputSize ),
    inputOrder: 'blocked',
    inputAccessOrder: 'blocked'
  } )}

  ${reduce( {
    value: 'value',
    scratch: 'scratch',
    workgroupSize: workgroupSize,
    identity: identity,
    combine: combine
  } )}

  if ( local_id.x == 0u ) {
    output[ workgroup_id.x ] = value;
  }
}
