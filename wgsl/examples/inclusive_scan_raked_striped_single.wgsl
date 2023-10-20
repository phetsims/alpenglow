// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ../gpu/left_scan

#option workgroupSize
#option grainSize

fn identity() -> f32 {
  return 0.0;
}

fn combine( a: f32, b: f32 ) -> f32 {
  return a + b;
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
  var baseIndex = workgroup_id.x * ${u32( workgroupSize * grainSize )} + local_id.x;
  var value = input[ baseIndex ];
  for ( var i = 1u; i < ${u32( grainSize )}; i++ ) {
    value = combine( value, input[ baseIndex + i * ${u32( workgroupSize )} ] );
  }

  ${left_scan( {
    value: 'value',
    scratch: 'scratch',
    workgroupSize: workgroupSize,
    identity: '0f',
    combine: ( a, b ) => `${a} + ${b}`,
    exclusive: true
  } )}

  for ( var i = 0u; i < ${u32( grainSize )}; i++ ) {
    value = combine( value, input[ baseIndex + i * ${u32( workgroupSize )} ] );
    output[ baseIndex + i * ${u32( workgroupSize )} ] = value;
  }
}
