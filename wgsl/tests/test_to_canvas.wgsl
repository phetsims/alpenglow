// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ../cag/LinearEdge

struct Config {
  num_edges: u32
}

@group(0) @binding(0)
var<uniform> config: Config;
@group(0) @binding(1)
var output: texture_storage_2d<${deviceContext.preferredStorageFormat}, write>;
@group(0) @binding(2)
var<storage> vertices: array<f32>;

#bindings

@compute @workgroup_size(16, 16)
fn main(
    @builtin(global_invocation_id) global_id: vec3u,
    @builtin(local_invocation_id) local_id: vec3u,
    @builtin(workgroup_id) wg_id: vec3u,
) {
  let p = vec2f( global_id.xy );
  // textureStore( output, global_id.xy, vec4( select( 0.0, 1.0, distance( p, vec2( 256.0, 256.0 ) ) < 100.0 ), 0.0, 0.0, 1.0 ) );
  // textureStore( output, global_id.xy, vec4( select( 0.0, 1.0, config.num_edges > 2 ), 0.0, 0.0, 1.0 ) );
  textureStore( output, global_id.xy, vec4( select( 0.0, 1.0, p.x < 5.0 ), 0.0, 0.0, 1.0 ) );
}
