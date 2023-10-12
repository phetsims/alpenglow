// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ../raster/RasterCompleteEdge

#option ExitCode
#option ReturnCode
#option StackBlendCode
#option LinearBlendCode
#option BlendComposeCode
#option OpaqueJumpCode
#option PremultiplyCode
#option UnpremultiplyCode
#option SRGBToLinearSRGBCode
#option LinearSRGBToSRGBCode
#option LinearDisplayP3ToLinearSRGBCode
#option LinearSRGBToLinearDisplayP3Code
#option OklabToLinearSRGBCode
#option LinearSRGBToOklabCode
#option NormalizeCode
#option NormalDebugCode
#option MultiplyScalarCode
#option PhongCode
#option PushCode
#option ComputeLinearBlendRatioCode
#option BarycentricBlendCode
#option BarycentricPerspectiveBlendCode
#option ComputeRadialBlendRatioCode
#option FilterCode
#option ComputeLinearGradientRatioCode
#option ComputeRadialGradientRatioCode
#option ImageCode

// TODO: options for these names
// TODO: way to do "overrideable" options, where they have a default in the shader program?
// Expects render_program_instructions: array<u32>
// Expects complete_edges: array<RasterCompleteEdge>
#bindings

// TODO: how to handle constant RenderPrograms

fn evaluate_render_program_instructions(
  render_program_index: u32,
  edgesOffset: u32,
  numEdges: u32,
  isFullArea: bool,
  area: f32,
  minX: f32,
  minY: f32,
  maxX: f32,
  maxY: f32,
  minXCount: i32,
  minYCount: i32,
  maxXCount: i32,
  maxYCount: i32
) -> vec4f {
  return vec4( 1f, 0f, 0f, 1f );
}
