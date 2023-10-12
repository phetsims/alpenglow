// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ../raster/RasterCompleteEdge

#option ExitCode
#option ReturnCode
// TODO
#option StackBlendCode
#option LinearBlendCode
// TODO
#option BlendComposeCode
// TODO
#option OpaqueJumpCode
// TODO
#option PremultiplyCode
// TODO
#option UnpremultiplyCode
// TODO
#option SRGBToLinearSRGBCode
// TODO
#option LinearSRGBToSRGBCode
// TODO
#option LinearDisplayP3ToLinearSRGBCode
// TODO
#option LinearSRGBToLinearDisplayP3Code
// TODO
#option OklabToLinearSRGBCode
// TODO
#option LinearSRGBToOklabCode
// TODO
#option NormalizeCode
// TODO
#option NormalDebugCode
// TODO
#option MultiplyScalarCode
// TODO
#option PhongCode
#option PushCode
#option ComputeLinearBlendRatioCode
// TODO
#option BarycentricBlendCode
// TODO
#option BarycentricPerspectiveBlendCode
// TODO
#option ComputeRadialBlendRatioCode
// TODO
#option FilterCode
// TODO
#option ComputeLinearGradientRatioCode
// TODO
#option ComputeRadialGradientRatioCode
// TODO
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

  // TODO: CENTROID OMG
  // TODO: CENTROID OMG
  // TODO: CENTROID OMG
  // TODO: CENTROID OMG
  // TODO: CENTROID OMG
  var centroid = vec2f( 0.5f, 0.5f );
  var fake_centroid = vec2f( 0.5f, 0.5f );

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
      case ${u32( ReturnCode )}: {
        instruction_stack_length--;
        instruction_address = instruction_stack[ instruction_stack_length ];
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
      case ${u32( LinearBlendCode )}: {
        let zero_color = stack[ stack_length - 1u ];
        let one_color = stack[ stack_length - 2u ];
        let t = stack[ stack_length - 3u ].x;

        stack_length -= 2u;

        if ( t <= 0f || t >= 1f ) {
          // If we're out of this range, the "top" value will always be this
          stack[ stack_length - 1u ] = zero_color;
        }
        else {
          let minus_t = 1f - t;

          stack[ stack_length - 1u ] = zero_color * minus_t + one_color * t;
        }
      }
      case ${u32( ComputeLinearBlendRatioCode )}: {
        let accuracy = instruction_u32 >> 8u;
        let zero_offset = render_program_instructions[ start_address + 1u ];
        let one_offset = render_program_instructions[ start_address + 2u ];
        let blend_offset = render_program_instructions[ start_address + 3u ];
        let scaled_normal = bitcast<vec2<f32>>( vec2(
          render_program_instructions[ start_address + 4u ],
          render_program_instructions[ start_address + 5u ]
        ) );
        let offset = bitcast<f32>( render_program_instructions[ start_address + 6u ] );

        let dot_product = dot( scaled_normal, select( fake_centroid, centroid, accuracy == 0u ) );
        let t = dot_product - offset;

        stack[ stack_length ] = vec4( t, 0f, 0f, 0f );
        stack_length++;

        // Queue these up to be in "reverse" order
        instruction_address = start_address + blend_offset; // jump to blend_location

        let has_zero = t < 1f;
        let has_one = t > 0f;

        if ( !has_zero || !has_one ) {
          stack_length++;
        }

        if ( has_zero ) {
          // call zero_location
          instruction_stack[ instruction_stack_length ] = instruction_address;
          instruction_stack_length++;
          instruction_address = start_address + zero_offset;
        }

        if ( has_one ) {
          // call one_location
          instruction_stack[ instruction_stack_length ] = instruction_address;
          instruction_stack_length++;
          instruction_address = start_address + one_offset;
        }
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
