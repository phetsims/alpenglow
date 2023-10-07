// Copyright 2023, University of Colorado Boulder

/**
 * TODO: docs
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./RasterStageConfig
#import ./RasterCompleteChunk
#import ./RasterCompleteEdge

#option workgroupSize
#option integerScale

@group(0) @binding(0)
var<uniform> config: RasterStageConfig;
@group(0) @binding(1)
var<storage, read> complete_chunks: array<RasterCompleteChunk>;
@group(0) @binding(2)
var<storage, read> complete_edges: array<RasterCompleteEdge>;
@group(0) @binding(3)
var<storage, read_write> accumulation: array<atomic<i32>>;

#bindings

@compute @workgroup_size(${workgroupSize})
fn main(
  @builtin(global_invocation_id) global_id: vec3u,
  @builtin(local_invocation_id) local_id: vec3u,
  @builtin(workgroup_id) workgroup_id: vec3u
) {
  // TODO: actual handling of RenderProgram/edges/etc.

  if ( global_id.x >= config.num_complete_chunks ) {
    return;
  }

  let chunk = complete_chunks[ global_id.x ];

  let render_program_index = chunk.bits & RasterCompleteChunk_bits_raster_program_index_mask;
  let is_full_area = ( chunk.bits & RasterCompleteChunk_bits_is_full_area_mask ) != 0u;
  let area = chunk.area;

  // TODO: handle 0.5 offsets for filters!!!!
  let minX = clamp( i32( round( chunk.minX + f32( config.raster_offset_x ) ) ), 0i, i32( config.raster_width ) );
  let minY = clamp( i32( round( chunk.minY + f32( config.raster_offset_y ) ) ), 0i, i32( config.raster_height ) );
  let maxX = clamp( i32( round( chunk.maxX + f32( config.raster_offset_x ) ) ), 0i, i32( config.raster_width ) );
  let maxY = clamp( i32( round( chunk.maxY + f32( config.raster_offset_y ) ) ), 0i, i32( config.raster_height ) );

  if ( minX >= maxX || minY >= maxY ) {
    return;
  }

  // sanity check TODO remove? This is to prevent crazy loops
  if ( minX < maxX - 0xffffi || minY < maxY - 0xffffi ) {
    return;
  }

  // NOTE: remember area might be larger for a multi-pixel constant area
  let pixel_area = select( area, 1.0f, is_full_area );

  let color = vec4f( 1.0f, 0.0f, 0.0f, 1.0f ); // TODO: RenderProgram

  let integer_color = vec4<i32>( round( color * ${f32( integerScale )} * pixel_area ) );

  for ( var y = minY; y < maxY; y += 1i ) {
    for ( var x = minX; x < maxX; x += 1i ) {
      let pixel_index = 4u * ( config.raster_width * u32( y ) + u32( x ) );

      atomicAdd( &accumulation[ pixel_index ], integer_color.r );
      atomicAdd( &accumulation[ pixel_index + 1u ], integer_color.g );
      atomicAdd( &accumulation[ pixel_index + 2u ], integer_color.b );
      atomicAdd( &accumulation[ pixel_index + 3u ], integer_color.a );
    }
  }
}
