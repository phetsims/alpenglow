// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ../gpu/right_scan

#option workgroupSize
#option inputSize

fn identity() -> f32 {
  return 0.0;
}

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
  var value = select( identity(), input[ global_id.x ], global_id.x < ${u32( inputSize )} );

  ${right_scan( {
    value: 'value',
    scratch: 'scratch',
    workgroupSize: workgroupSize,
    identity: '0f',
    combine: ( a, b ) => `${a} + ${b}`,
    skipLastScratch: true
  } )}

  if ( local_id.x == 0u ) {
    output[ workgroup_id.x ] = value;
  }
}
