// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ../color/linear_sRGB_to_sRGB
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

  let float_value = vec4<f32>( accumulation_value ) * vec4( ${f32( 1 / integerScale )} );

  // TODO: gamut map!
//  let mapped_value = clamp( float_value, vec4( 0f ), vec4( 1f ) );
  let mapped_value = vec4( select( 0f, 1f, accumulation_value.a != 0i ), 0f, 0f, 1f );

  textureStore( output, global_id.xy, vec4( linear_sRGB_to_sRGB( mapped_value.rgb ), mapped_value.a ) );
}
