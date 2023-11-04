// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ../../gpu/left_scan

#option workgroupSize

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
  var value = input[ global_id.x ];

  ${left_scan( {
    value: 'value',
    scratch: 'scratch',
    workgroupSize: workgroupSize,
    identity: '0f',
    combine: ( a, b ) => `${a} + ${b}`,
    exclusive: true
  } )}

  output[ local_id.x ] = value;
}
