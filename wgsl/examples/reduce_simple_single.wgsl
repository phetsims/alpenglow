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

const WORKGROUP_SIZE = ${u32( workgroupSize )};
const LOG_WORKGROUP_SIZE = ${u32( Math.log2( workgroupSize ) )};

@group(0) @binding(0)
var<storage> input: array<f32>;
@group(0) @binding(1)
var<storage, read_write> output: array<f32>;

var<workgroup> scratch: array<f32, WORKGROUP_SIZE>;

#bindings

@compute @workgroup_size(${workgroupSize})
fn main(
    @builtin(global_invocation_id) global_id: vec3u,
    @builtin(local_invocation_id) local_id: vec3u,
    @builtin(workgroup_id) wg_id: vec3u,
) {
  var value = input[ global_id.x ];
  scratch[ local_id.x ] = value;
  for ( var i = 0u; i < LOG_WORKGROUP_SIZE; i += 1u ) {
    workgroupBarrier();

    let index = local_id.x + ( 1u << i );
    if ( index < WORKGROUP_SIZE ) {
      let otherValue = scratch[ index ];
      value = combine( value, otherValue );
    }

    workgroupBarrier();
    scratch[ local_id.x ] = value;
  }
  if ( local_id.x == 0u ) {
    output[ 0u ] = value;
  }
}
