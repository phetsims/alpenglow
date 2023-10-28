// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

@group(0) @binding(0)
var<storage> a: array<i32>;
@group(0) @binding(1)
var<storage> b: array<i32>;
@group(0) @binding(2)
var<storage, read_write> c: array<i32>;

@compute @workgroup_size(64)
fn main( @builtin(global_invocation_id) global_id: vec3u ) {
  let start_output = min( 2300u, global_id.x * 8u );
  let end_output = min( 2300u, start_output + 8u );
  if ( start_output != end_output ) {
    var gc_i_low: u32 = select( 0u, end_output - 1000u, end_output > 1000u );
    if ( global_id.x == 0u ) {
      c[ 0u ] = i32( gc_i_low );
      c[ 1u ] = select( 0i, 1i, i32( gc_i_low ) >= 0i );
      c[ 2u ] = i32( start_output );
      c[ 3u ] = i32( end_output );
      c[ 4u] = i32( gc_i_low );
      c[ 5u ] = 0i;
      c[ 6u ] = -1000i;
      c[ 7u ] = 1000i;
    }
  }
}
