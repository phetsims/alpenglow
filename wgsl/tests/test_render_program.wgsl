// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ../raster/RasterCompleteEdge
#import ../render-program/evaluate_render_program_instructions

struct Config {
  render_program_index: u32,
  edgesOffset: u32,
  numEdges: u32,
  isFullArea: u32, // 1 or 0
  needsFace: u32, // 1 or 0
  area: f32,
  minX: f32,
  minY: f32,
  maxX: f32,
  maxY: f32,
  minXCount: i32,
  minYCount: i32,
  maxXCount: i32,
  maxYCount: i32
}

@group(0) @binding(0)
var<uniform> config: Config;
@group(0) @binding(1)
var<storage, read> render_program_instructions: array<u32>;
@group(0) @binding(2)
var<storage, read> complete_edges: array<RasterCompleteEdge>;
@group(0) @binding(3)
var<storage, read_write> output: vec4<f32>;

#bindings

@compute @workgroup_size(1)
fn main(
  @builtin(global_invocation_id) global_id: vec3u,
  @builtin(local_invocation_id) local_id: vec3u,
  @builtin(workgroup_id) wg_id: vec3u
) {
  output = evaluate_render_program_instructions(
    config.render_program_index,
    config.edgesOffset,
    config.numEdges,
    config.isFullArea != 0u,
    config.needsFace != 0u,
    config.area,
    config.minX,
    config.minY,
    config.maxX,
    config.maxY,
    config.minXCount,
    config.minYCount,
    config.maxXCount,
    config.maxYCount
  );
}
