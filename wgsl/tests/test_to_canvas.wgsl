// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ../cag/LinearEdge
#import ../clip/bounds_double_area_edge

#option preferredStorageFormat

struct Config {
  num_edges: u32
}

@group(0) @binding(0)
var<uniform> config: Config;
@group(0) @binding(1)
var output: texture_storage_2d<${preferredStorageFormat}, write>;
@group(0) @binding(2)
var<storage> vertices: array<f32>;

#bindings

@compute @workgroup_size(16, 16)
fn main(
    @builtin(global_invocation_id) global_id: vec3u,
    @builtin(local_invocation_id) local_id: vec3u,
    @builtin(workgroup_id) wg_id: vec3u,
) {
  let minPoint = vec2f( global_id.xy );
  let maxPoint = minPoint + 1.0;
  let center = 0.5 * ( minPoint + maxPoint );

  var double_area = 0f;
  for ( var i: u32 = 0; i < config.num_edges; i++ ) {
    let edge = LinearEdge( vec2( vertices[ i * 4 + 0 ], vertices[ i * 4 + 1 ] ), vec2( vertices[ i * 4 + 2 ], vertices[ i * 4 + 3 ] ) );
    double_area += bounds_double_area_edge( edge, minPoint.x, minPoint.y, maxPoint.x, maxPoint.y, center.x, center.y );
  }

  let area = 0.5 * double_area;
  let value = 1f - clamp( area, 0f, 1f );

  textureStore( output, global_id.xy, vec4( value, value, value, 1.0 ) );
}
