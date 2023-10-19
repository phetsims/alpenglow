// Copyright 2023, University of Colorado Boulder

/**
 * For use in PerformanceTesting
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#option workgroupSize

@group(0) @binding(0)
var<storage, read_write> input: array<f32>;
@group(0) @binding(1)
var<storage, read_write> output: array<f32>;

#bindings

@compute @workgroup_size(${workgroupSize})
fn main(
  @builtin(global_invocation_id) global_id: vec3u,
  @builtin(local_invocation_id) local_id: vec3u,
  @builtin(workgroup_id) workgroup_id: vec3u
) {
  output[ global_id.x ] = input[ global_id.x ];
}
