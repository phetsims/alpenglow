// Copyright 2023, University of Colorado Boulder

/**
 * For use in PerformanceTesting
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#option workgroupSize

@group(0) @binding(0)
var<storage, read> input: array<f32>;
@group(0) @binding(1)
var<storage, read_write> output: array<f32>;

var<workgroup> scratch: array<f32, ${u32( workgroupSize )}>;

#bindings

@compute @workgroup_size(${workgroupSize})
fn main(
  @builtin(global_invocation_id) global_id: vec3u,
  @builtin(local_invocation_id) local_id: vec3u,
  @builtin(workgroup_id) workgroup_id: vec3u
) {
  var value = input[ global_id.x ];
  scratch[ local_id.x ] = value;

  // Extra loop just runs it a bunch, for performance (overlap) testing
  for ( var j = 0u; j < 1000u; j += 1u ) {
    for ( var i = 0u; i < ${u32( Math.log2( workgroupSize ) )}; i += 1u ) {
      workgroupBarrier();

      if ( local_id.x >= 1u << i ) {
        let otherValue = scratch[ local_id.x - ( 1u << i ) ];
        value = otherValue + value;
      }

      workgroupBarrier();
      scratch[ local_id.x ] = value;
    }
  }

  output[ global_id.x ] = scratch[ local_id.x ];
}
