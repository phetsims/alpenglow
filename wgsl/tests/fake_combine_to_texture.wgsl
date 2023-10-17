// Copyright 2023, University of Colorado Boulder

/**
 * For use in PerformanceTesting
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#option preferredStorageFormat

@group(0) @binding(0)
var<storage, read_write> buffer_a: array<f32>;
@group(0) @binding(1)
var<storage, read_write> buffer_b: array<f32>;
@group(0) @binding(2)
var<storage, read_write> buffer_c: array<f32>;
@group(0) @binding(3)
var<storage, read_write> buffer_d: array<f32>;
@group(0) @binding(4)
var output: texture_storage_2d<${preferredStorageFormat}, write>;

#bindings

@compute @workgroup_size(16, 16)
fn main(
  @builtin(global_invocation_id) global_id: vec3u,
  @builtin(local_invocation_id) local_id: vec3u,
  @builtin(workgroup_id) wg_id: vec3u
) {
  let index = global_id.y * 16u + global_id.x;
  let bufferSum = buffer_a[ index ] + buffer_b[ index ] + buffer_c[ index ] + buffer_d[ index ];
  textureStore( output, global_id.xy, vec4( ( 1f / ( 4f * ( 1f + f32( index ) ) ) ) * bufferSum, 0.1f, 0f, 1f ) );
}
