// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ../color/linear_sRGB_to_sRGB
#import ../color/gamut_map_linear_displayP3
#import ../color/gamut_map_linear_sRGB
#import ../color/linear_sRGB_to_sRGB
#import ../color/premultiply
#import ../color/unpremultiply
#import ./RasterStageConfig

#option preferredStorageFormat
#option integerScale

@group(0) @binding(0)
var<uniform> config: RasterStageConfig;
@group(0) @binding(1)
var<storage, read> accumulation: array<i32>;
@group(0) @binding(2)
var output: texture_storage_2d<${preferredStorageFormat}, write>;

#bindings

@compute @workgroup_size(16, 16)
fn main(
  @builtin(global_invocation_id) global_id: vec3u,
  @builtin(local_invocation_id) local_id: vec3u,
  @builtin(workgroup_id) workgroup_id: vec3u
) {
  if ( global_id.x >= config.raster_width || global_id.y >= config.raster_height ) {
    return;
  }

  let accumulation_index = 4u * ( global_id.x + global_id.y * config.raster_width );
  let accumulation_value = vec4(
    accumulation[ accumulation_index ],
    accumulation[ accumulation_index + 1u ],
    accumulation[ accumulation_index + 2u ],
    accumulation[ accumulation_index + 3u ]
  );

  let linear_unmapped_color = unpremultiply( vec4<f32>( accumulation_value ) * vec4( ${f32( 1 / integerScale )} ) );

  var output_color = vec4( 0f );
  if ( linear_unmapped_color.a > 1e-8f ) {
    switch ( config.raster_color_space ) {
      case 0u: {
        output_color = vec4(
          linear_sRGB_to_sRGB( gamut_map_linear_sRGB( linear_unmapped_color.rgb ) ),
          min( 1f, linear_unmapped_color.a )
        );
      }
      case 1u: {
        output_color = vec4(
          linear_sRGB_to_sRGB( gamut_map_linear_displayP3( linear_unmapped_color.rgb ) ),
          min( 1f, linear_unmapped_color.a )
        );
      }
      default: {
        output_color = vec4( 1f, 0.5f, 0.111111, 1f );
      }
    }
  }

  textureStore( output, global_id.xy, premultiply( output_color ) );
}
