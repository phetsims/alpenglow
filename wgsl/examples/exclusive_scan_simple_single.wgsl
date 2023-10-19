// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#option workgroupSize

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
  var value = input[ global_id.x ];
  scratch[ local_id.x ] = value;

  for ( var i = 0u; i < ${u32( Math.log2( workgroupSize ) )}; i++ ) {
    workgroupBarrier();

    if ( local_id.x >= 1u << i ) {
      let otherValue = scratch[ local_id.x - ( 1u << i ) ];
      value = combine( otherValue, value );
    }

    workgroupBarrier();

    scratch[ local_id.x ] = value;
  }

  // TODO: could also shift at the start to avoid this workgroupBarrier()
  workgroupBarrier();

  output[ local_id.x ] = select( identity(), scratch[ local_id.x - 1u ], local_id.x > 0u );
}
