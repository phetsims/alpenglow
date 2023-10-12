// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ../raster/RasterCompleteEdge
#import ../color/premultiply
#import ../color/unpremultiply
#import ../color/sRGB_to_linear_sRGB
#import ../color/linear_sRGB_to_sRGB
#import ../color/linear_sRGB_to_oklab
#import ../color/oklab_to_linear_sRGB
#import ../color/linear_displayP3_to_linear_sRGB
#import ../color/linear_sRGB_to_linear_displayP3
#import ../color/blend_compose
#import ./extend_f32
#import ./extend_i32

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
// TODO
#option ImageCode

#option GradientTypeCircular
#option GradientTypeStrip
#option GradientTypeFocalOnCircle
#option GradientTypeCone

#option stackSize
#option instructionStackSize

const oops_inifinite_loop_code = vec4f( 5f, 4f, -5f, -4f );

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
  var real_centroid = vec2f( 0.5f, 0.5f );
  var fake_centroid = vec2f( 0.5f, 0.5f );

  while ( !is_done ) {
    oops_count++;
    if ( oops_count > 0xfffu ) {
      return oops_inifinite_loop_code;
    }

    let start_address = instruction_address;
    let instruction_u32 = render_program_instructions[ instruction_address ];

    let code = ( instruction_u32 & 0xffu );

    var instruction_length: u32;
    // High 4 bits all zero >= 1 length
    if ( ( code >> 4u ) == 0u ) {
      instruction_length = 1u;
    }
    // High 2 bits set >= variable length
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
      case ${u32( StackBlendCode )}: {
        let background = stack[ stack_length - 1u ];
        let foreground = stack[ stack_length - 2u ];

        stack_length--;

        // Assume premultiplied
        stack[ stack_length - 1u ] = ( 1f - foreground.a ) * background + foreground;
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
      case ${u32( OpaqueJumpCode )}: {
        let offset = instruction_u32 >> 8u;
        let color = stack[ stack_length - 1u ];
        if ( color.a >= ${f32( 1 - 1e-5 )} ) {
          instruction_address = start_address + offset; // jump to offset
        }
      }
      case ${u32( NormalizeCode )}: {
        stack[ stack_length - 1u ] = normalize( stack[ stack_length - 1u ] );
      }
      case ${u32( PremultiplyCode )}: {
        stack[ stack_length - 1u ] = premultiply( stack[ stack_length - 1u ] );
      }
      case ${u32( UnpremultiplyCode )}: {
        stack[ stack_length - 1u ] = unpremultiply( stack[ stack_length - 1u ] );
      }
      case ${u32( SRGBToLinearSRGBCode )}: {
        let color = stack[ stack_length - 1u ];
        stack[ stack_length - 1u ] = vec4( sRGB_to_linear_sRGB( color.rgb ), color.a );
      }
      case ${u32( LinearSRGBToSRGBCode )}: {
        let color = stack[ stack_length - 1u ];
        stack[ stack_length - 1u ] = vec4( linear_sRGB_to_sRGB( color.rgb ), color.a );
      }
      case ${u32( LinearDisplayP3ToLinearSRGBCode )}: {
        let color = stack[ stack_length - 1u ];
        stack[ stack_length - 1u ] = vec4( linear_displayP3_to_linear_sRGB( color.rgb ), color.a );
      }
      case ${u32( LinearSRGBToLinearDisplayP3Code )}: {
        let color = stack[ stack_length - 1u ];
        stack[ stack_length - 1u ] = vec4( linear_sRGB_to_linear_displayP3( color.rgb ), color.a );
      }
      case ${u32( OklabToLinearSRGBCode )}: {
        let color = stack[ stack_length - 1u ];
        stack[ stack_length - 1u ] = vec4( oklab_to_linear_sRGB( color.rgb ), color.a );
      }
      case ${u32( LinearSRGBToOklabCode )}: {
        let color = stack[ stack_length - 1u ];
        stack[ stack_length - 1u ] = vec4( linear_sRGB_to_oklab( color.rgb ), color.a );
      }
      case ${u32( NormalDebugCode )}: {
        let normal = stack[ stack_length - 1u ];
        stack[ stack_length - 1u ] = vec4( normal.rgb * 0.5f + 0.5f, 1f );
      }
      case ${u32( BlendComposeCode )}: {
        let color_a = stack[ stack_length - 1u ];
        let color_b = stack[ stack_length - 2u ];
        let compose_type = ( instruction_u32 >> 8u ) & 0x7u;
        let blend_type = ( instruction_u32 >> 11u ) & 0xfu;

        stack_length--;

        stack[ stack_length - 1u ] = blend_compose( color_a, color_b, compose_type, blend_type );
      }
      case ${u32( MultiplyScalarCode )}: {
        let factor = bitcast<f32>( render_program_instructions[ start_address + 1u ] );
        stack[ stack_length - 1u ] = factor * stack[ stack_length - 1u ];
      }
      case ${u32( ComputeLinearBlendRatioCode )}, ${u32( ComputeRadialBlendRatioCode )}: {
        var t: f32;

        let accuracy = instruction_u32 >> 8u;
        let zero_offset = render_program_instructions[ start_address + 1u ];
        let one_offset = render_program_instructions[ start_address + 2u ];
        let blend_offset = render_program_instructions[ start_address + 3u ];
        if ( code == ${u32( ComputeLinearBlendRatioCode )} ) {
          let scaled_normal = bitcast<vec2<f32>>( vec2(
            render_program_instructions[ start_address + 4u ],
            render_program_instructions[ start_address + 5u ]
          ) );
          let offset = bitcast<f32>( render_program_instructions[ start_address + 6u ] );

          let centroid = select( fake_centroid, real_centroid, accuracy == 0u );
          let dot_product = dot( scaled_normal, centroid );
          t = dot_product - offset;
        }
        else {
          let inverse_transform = mat3x3(
            bitcast<f32>( render_program_instructions[ start_address + 4u ] ),
            bitcast<f32>( render_program_instructions[ start_address + 7u ] ),
            0f,
            bitcast<f32>( render_program_instructions[ start_address + 5u ] ),
            bitcast<f32>( render_program_instructions[ start_address + 8u ] ),
            0f,
            bitcast<f32>( render_program_instructions[ start_address + 6u ] ),
            bitcast<f32>( render_program_instructions[ start_address + 9u ] ),
            1f
          );
          let radius0 = bitcast<f32>( render_program_instructions[ start_address + 10u ] );
          let radius1 = bitcast<f32>( render_program_instructions[ start_address + 11u ] );

          var average_distance: f32;

          if ( accuracy == 0u ) {
            // TODO: evaluate the integral!!!!!
            let localPoint = inverse_transform * vec3( real_centroid, 1f );
            average_distance = length( localPoint );
          }
          else {
            let centroid = select( fake_centroid, real_centroid, accuracy == 1u );
            let localPoint = inverse_transform * vec3( centroid, 1f );
            average_distance = length( localPoint.xy );
          }

          t = ( average_distance - radius0 ) / ( radius1 - radius0 );
        }

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
      case ${u32( ComputeLinearGradientRatioCode )}, ${u32( ComputeRadialGradientRatioCode )}: {
        let is_linear = code == ${u32( ComputeLinearGradientRatioCode )};

        let accuracy = ( instruction_u32 >> 8u ) & 0x7u;
        let extend = ( instruction_u32 >> 11u ) & 0x2u;
        let ratio_count = instruction_u32 >> 16u;

        let transform = mat3x3(
          bitcast<f32>( render_program_instructions[ start_address + 1u ] ),
          bitcast<f32>( render_program_instructions[ start_address + 4u ] ),
          0f,
          bitcast<f32>( render_program_instructions[ start_address + 2u ] ),
          bitcast<f32>( render_program_instructions[ start_address + 5u ] ),
          0f,
          bitcast<f32>( render_program_instructions[ start_address + 3u ] ),
          bitcast<f32>( render_program_instructions[ start_address + 6u ] ),
          1f
        );

        var t: f32;
        if ( is_linear ) {
          let inverse_transform = transform;
          let start = bitcast<vec2<f32>>( vec2(
              render_program_instructions[ start_address + 7u ],
              render_program_instructions[ start_address + 8u ]
          ) );
          let grad_delta = bitcast<vec2<f32>>( vec2(
              render_program_instructions[ start_address + 9u ],
              render_program_instructions[ start_address + 10u ]
          ) );

          let centroid = select( fake_centroid, real_centroid, accuracy == 0u || accuracy == 2u );

          let local_point = ( inverse_transform * vec3( centroid, 1f ) ).xy;
          let local_delta = local_point - start;

          let raw_t = select( 0f, dot( local_delta, grad_delta ) / dot( grad_delta, grad_delta ), length( grad_delta ) > 0f, );

          t = extend_f32( raw_t, extend );
        }
        else {
          let kind = ( instruction_u32 >> 13u ) & 0x3u;
          let is_swapped = ( ( instruction_u32 >> 15u ) % 0x1u ) != 0u;
          let conic_transform = transform;
          let focal_x = bitcast<f32>( render_program_instructions[ start_address + 7u ] );
          let radius = bitcast<f32>( render_program_instructions[ start_address + 8u ] );

          // A good chunk of the code here is borrowed from Vello (https://github.com/linebender/vello)
          /*
          Copyright (c) 2020 Raph Levien

          Permission is hereby granted, free of charge, to any
          person obtaining a copy of this software and associated
          documentation files (the "Software"), to deal in the
          Software without restriction, including without
          limitation the rights to use, copy, modify, merge,
          publish, distribute, sublicense, and/or sell copies of
          the Software, and to permit persons to whom the Software
          is furnished to do so, subject to the following
          conditions:

          The above copyright notice and this permission notice
          shall be included in all copies or substantial portions
          of the Software.

          THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF
          ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED
          TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
          PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT
          SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
          CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
          OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR
          IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
          DEALINGS IN THE SOFTWARE.
          */

          let is_strip = kind == ${u32( GradientTypeStrip )};
          let is_circular = kind == ${u32( GradientTypeCircular )};
          let is_focal_on_circle = kind == ${u32( GradientTypeFocalOnCircle )};
          let r1_recip = select( 1.f / radius, 0f, is_circular );
          let less_scale = select( 1f, -1f, is_swapped || ( 1f - focal_x ) < 0f );
          let t_sign = sign( 1f - focal_x );

          // TODO: centroid handling for this
          let centroid = select( fake_centroid, real_centroid, accuracy == 0u || accuracy == 1u || accuracy == 3u );
          let point = centroid;

          // Pixel-specifics
          // TODO: optimization?
          let local_xy = ( conic_transform * vec3( point, 1f ) ).xy;
          let x = local_xy.x;
          let y = local_xy.y;
          let xx = x * x;
          let yy = y * y;
          var is_valid = true;
          if ( is_strip ) {
            let a = radius - yy;
            t = sqrt( a ) + x;
            is_valid = a >= 0f;
          }
          else if ( is_focal_on_circle ) {
            t = ( xx + yy ) / x;
            is_valid = t >= 0f && x != 0f;
          }
          else if ( radius > 1f ) {
            t = sqrt( xx + yy ) - x * r1_recip;
          }
          else { // radius < 1
            let a = xx - yy;
            t = less_scale * sqrt( a ) - x * r1_recip;
            is_valid = a >= 0f && t >= 0f;
          }
          if ( is_valid ) {
            t = extend_f32( focal_x + t_sign * t, extend );
            if ( is_swapped ) {
              t = 1f - t;
            }
          }
        }

        let blend_offset = select( 9u, 11u, is_linear );
        let stops_offset = blend_offset + 1u; // ratio, stopOffset pairs

        let blend_address = start_address + render_program_instructions[ start_address + blend_offset ];

        var i = -1i;
        while (
          i < i32( ratio_count ) - 1i &&
          bitcast<f32>( render_program_instructions[ start_address + stops_offset + 2u * u32( i + 1i ) ] ) < t
        ) {
          oops_count++;
          if ( oops_count > 0xfffu ) {
            return oops_inifinite_loop_code;
          }

          i++;
        }

        // Queue these up to be in "reverse" order
        instruction_address = blend_address; // jump to blend_location

        if ( i == -1i ) {
          stack[ stack_length ] = vec4( 0f, 0f, 0f, 0f ); // number 0, for t
          stack[ stack_length + 1u ] = vec4( 0f, 0f, 0f, 0f ); // spacer
          stack_length += 2;

          // call stopLocations[ 0 ]
          instruction_stack[ instruction_stack_length ] = instruction_address;
          instruction_stack_length++;
          instruction_address = start_address + render_program_instructions[ start_address + stops_offset + 1u ];
        }
        else if ( i == i32( ratio_count ) - 1i ) {
          stack[ stack_length ] = vec4( 1f, 0f, 0f, 0f ); // number 1, for t
          stack[ stack_length + 1u ] = vec4( 0f, 0f, 0f, 0f ); // spacer
          stack_length += 2;

          // call stopLocations[ i ]
          instruction_stack[ instruction_stack_length ] = instruction_address;
          instruction_stack_length++;
          instruction_address = start_address + render_program_instructions[ start_address + stops_offset + 2u * u32( i ) + 1u ];
        }
        else {
          // TODO: create stops_address to factor out these additions!
          let ratio_before = bitcast<f32>( render_program_instructions[ start_address + stops_offset + 2u * u32( i ) ] );
          let ratio_after = bitcast<f32>( render_program_instructions[ start_address + stops_offset + 2u * u32( i + 1i ) ] );

          let ratio = ( t - ratio_before ) / ( ratio_after - ratio_before );

          stack[ stack_length ] = vec4( ratio, 0f, 0f, 0f );
          stack_length++;

          let hasBefore = ratio < 1f;
          let hasAfter = ratio > 0f;

          if ( !hasBefore || !hasAfter ) {
            stack[ stack_length ] = vec4( 0f, 0f, 0f, 0f ); // spacer TODO: can we NOT write to our spacers?
            stack_length++;
          }

          if ( hasBefore ) {
            // call stopLocations[ i ]
            instruction_stack[ instruction_stack_length ] = instruction_address;
            instruction_stack_length++;
            instruction_address = start_address + render_program_instructions[ start_address + stops_offset + 2u * u32( i ) + 1u ];
          }

          if ( hasAfter ) {
            // call stopLocations[ i + 1 ]
            instruction_stack[ instruction_stack_length ] = instruction_address;
            instruction_stack_length++;
            instruction_address = start_address + render_program_instructions[ start_address + stops_offset + 2u * u32( i + 1i ) + 1u ];
          }
        }
      }
      case ${u32( BarycentricBlendCode )}, ${u32( BarycentricPerspectiveBlendCode )}: {
        let accuracy = instruction_u32 >> 8u;

        let det = bitcast<f32>( render_program_instructions[ start_address + 1u ] );
        let diff_a = bitcast<vec2<f32>>( vec2(
          render_program_instructions[ start_address + 2u ],
          render_program_instructions[ start_address + 3u ]
        ) );
        let diff_b = bitcast<vec2<f32>>( vec2(
          render_program_instructions[ start_address + 4u ],
          render_program_instructions[ start_address + 5u ]
        ) );
        let point_c = bitcast<vec2<f32>>( vec2(
          render_program_instructions[ start_address + 6u ],
          render_program_instructions[ start_address + 7u ]
        ) );

        let color_a = stack[ stack_length - 1u ];
        let color_b = stack[ stack_length - 2u ];
        let color_c = stack[ stack_length - 3u ];

        stack_length -= 2u;

        let point = select( fake_centroid, real_centroid, accuracy == 0u );

        let lambda_a = dot( diff_a, point - point_c ) / det;
        let lambda_b = dot( diff_b, point - point_c ) / det;
        let lambda_c = 1f - lambda_a - lambda_b;

        if ( code == ${u32( BarycentricBlendCode )} ) {
          stack[ stack_length - 1u ] = color_a * lambda_a + color_b * lambda_b + color_c * lambda_c;
        }
        // Perspective-correction
        else {
          let z_inverse_a = lambda_a * bitcast<f32>( render_program_instructions[ start_address + 8u ] );
          let z_inverse_b = lambda_b * bitcast<f32>( render_program_instructions[ start_address + 9u ] );
          let z_inverse_c = lambda_c * bitcast<f32>( render_program_instructions[ start_address + 10u ] );

          stack[ stack_length - 1u ] = (
            color_a * z_inverse_a +
            color_b * z_inverse_b +
            color_c * z_inverse_c
          ) / ( z_inverse_a + z_inverse_b + z_inverse_c );
        }
      }
      case ${u32( FilterCode )}: {
        // TODO: don't require a transpose here, just do it
        let matrix = transpose( mat4x4(
          bitcast<f32>( render_program_instructions[ start_address + 1u ] ),
          bitcast<f32>( render_program_instructions[ start_address + 2u ] ),
          bitcast<f32>( render_program_instructions[ start_address + 3u ] ),
          bitcast<f32>( render_program_instructions[ start_address + 4u ] ),
          bitcast<f32>( render_program_instructions[ start_address + 5u ] ),
          bitcast<f32>( render_program_instructions[ start_address + 6u ] ),
          bitcast<f32>( render_program_instructions[ start_address + 7u ] ),
          bitcast<f32>( render_program_instructions[ start_address + 8u ] ),
          bitcast<f32>( render_program_instructions[ start_address + 9u ] ),
          bitcast<f32>( render_program_instructions[ start_address + 10u ] ),
          bitcast<f32>( render_program_instructions[ start_address + 11u ] ),
          bitcast<f32>( render_program_instructions[ start_address + 12u ] ),
          bitcast<f32>( render_program_instructions[ start_address + 13u ] ),
          bitcast<f32>( render_program_instructions[ start_address + 14u ] ),
          bitcast<f32>( render_program_instructions[ start_address + 15u ] ),
          bitcast<f32>( render_program_instructions[ start_address + 16u ] )
        ) );

        let translation = bitcast<vec4<f32>>( vec4(
          render_program_instructions[ start_address + 17u ],
          render_program_instructions[ start_address + 18u ],
          render_program_instructions[ start_address + 19u ],
          render_program_instructions[ start_address + 20u ]
        ) );

        stack[ stack_length - 1u ] = matrix * stack[ stack_length - 1u ] + translation;
      }
      case ${u32( PhongCode )}: {
        let alpha = bitcast<f32>( render_program_instructions[ start_address + 1u ] );
        let num_lights = render_program_instructions[ start_address + 2u ];

        let ambient = stack[ stack_length - 1u ];
        let diffuse = stack[ stack_length - 2u ];
        let specular = stack[ stack_length - 3u ];
        let position = stack[ stack_length - 4u ];
        let normal = stack[ stack_length - 5u ];
        stack_length -= 4u;

        var output = ambient;

        // TODO: don't assume camera is at origin?
        let view_direction = normalize( -position );

        for ( var i = 0u; i < num_lights; i++ ) {
          oops_count++;
          if ( oops_count > 0xfffu ) {
            return oops_inifinite_loop_code;
          }

          // TODO: really examine stack sizes, since it affects what we do here!!!

          let light_direction = stack[ stack_length - 2u ];
          let light_color = stack[ stack_length - 3u ];
          stack_length -= 2u;

          let dot_product = dot( normal, light_direction );
          if ( dot_product > 0f ) {
            // TODO: consider reflect()? TODO: make sure this isn't reversed (we have different sign convention, no?)
            let reflection = 2f * dot_product * normal - light_direction;
            let specular_amount = pow( dot( reflection, view_direction ), alpha );

            output += light_color * (
              // keep alphas?
              diffuse * vec4( vec3( dot_product ), 1f ) +
              specular * vec4( vec3( specular_amount ), 1f )
            );
          }
        }

        // clamp for now
        stack[ stack_length - 1u ] = clamp( output, vec4( 0f ), vec4( 1f ) );
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
