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

#option stackSize
#option instructionStackSize

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
  var stack: array<vec4f,${stackSize}>;
  var instruction_stack: array<u32,${instructionStackSize}>;

  var stack_length = 0u;
  var instruction_stack_length = 0u;

  var instruction_address = render_program_index;
  var is_done = false;

  var oops_count = 0u;

  while ( !is_done ) {
    oops_count++;
    if ( oops_count > 0xfffu ) {
      // TODO: a more noticeable error code?
      return vec4f( 5f, 4f, -5f, -4f );
    }

    let start_address = instruction_address;
    let instruction_u32 = render_program_instructions[ instruction_address ];

    let code = ( instruction_u32 & 0xffu );

    var instruction_length: u32;
    // High 4 bits all zero => 1 length
    if ( ( code >> 4u ) == 0u ) {
      instruction_length = 1u;
    }
    // High 2 bits set => variable length
    else if ( ( code & 0xc0u ) != 0u ) {
      instruction_length = ( code & 0x1fu ) + 2u * ( instruction_u32 >> 16u );
    }
    // Just high bit set, we'll read the length in the lower-5 bits
    else {
      instruction_length = ( code & 0x1fu );
    }
    instruction_address += instruction_length;

    switch ( code ) {
      case ${u32( ExitCode )}: {
        is_done = true;
      }
      case ${u32( PushCode )}: {
        stack[ stack_length ] = bitcast<vec4<f32>>( vec4(
          render_program_instructions[ start_address + 1u ],
          render_program_instructions[ start_address + 2u ],
          render_program_instructions[ start_address + 3u ],
          render_program_instructions[ start_address + 4u ]
        ) );
        stack_length++;
      }
      default: {
        // TODO: a more noticeable error code?
        return vec4f( -1f, -1f, -1f, -1f );
      }
    }
  }

  // TODO: error handling?

  return stack[ 0u ];
}
