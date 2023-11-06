// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ../../gpu/from_striped_index
#import ../../gpu/unroll

#option workgroupSize
#option grainSize

@group(0) @binding(0)
var<storage> input: array<u32>;
@group(0) @binding(1)
var<storage, read_write> output: array<u32>;

#bindings

@compute @workgroup_size(${workgroupSize})
fn main(
  @builtin(global_invocation_id) global_id: vec3u,
  @builtin(local_invocation_id) local_id: vec3u,
  @builtin(workgroup_id) workgroup_id: vec3u
) {
  ${unroll( 0, grainSize, i => `
    {
      // This is a horrible access pattern. We'd obviously use output[ global_id.x ] = input[ to_striped_index... ] if we
      // weren't just testing our functions.
      let index = global_id.x * ${grainSize} + ${u32( i )};
      output[ ${from_striped_index( {
        i: `index`,
        workgroupSize: workgroupSize,
        grainSize: grainSize
      } )} ] = input[ index ];
    }
  ` )}
}
