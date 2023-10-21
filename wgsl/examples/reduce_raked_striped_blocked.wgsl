// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ../gpu/right_scan

#option workgroupSize
#option grainSize
#option inputSize

fn identity() -> f32 {
  return 0.0;
}

// TODO: template these!!
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
  var base_index = workgroup_id.x * ${u32( workgroupSize * grainSize )} + local_id.x;
  var value = select( identity(), input[ base_index ], base_index < ${u32( inputSize )} );
  for ( var i = 1u; i < ${u32( grainSize )}; i++ ) {
    let index = base_index + i * ${u32( workgroupSize )};
    value = combine( value, select( identity(), input[ index ], index < ${u32( inputSize )} ) );
  }

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
