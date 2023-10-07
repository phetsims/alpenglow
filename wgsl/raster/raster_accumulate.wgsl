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
  let x = i32( round( chunk.minX + f32( config.raster_offset_x ) ) );
  let y = i32( round( chunk.minY + f32( config.raster_offset_y ) ) );
  let width = i32( round( chunk.maxX - chunk.minX ) );
  let height = i32( round( chunk.maxY - chunk.minY ) );

  // TODO!!
  // NOTE: remember area might be larger for a multi-pixel constant area
  let color = vec4f( 1.0f, 0.0f, 0.0f, 1.0f );
  let integer_color = vec4<i32>( round( color * ${f32( integerScale )} * select( area, 1.0f, is_full_area ) ) );

  // TODO: optimize!!
  for ( var py = y; py < y + height; py++ ) {
    if ( py < 0i || py >= i32( config.raster_height ) ) {
      continue;
    }
    for ( var px = x; px < x + width; px++ ) {
      if ( px < 0i || px >= i32( config.raster_width ) ) {
        continue;
      }

      let pixel_index = 4u * ( config.raster_width * u32( py ) + u32( px ) );

      atomicAdd( &accumulation[ pixel_index ], integer_color.r );
      atomicAdd( &accumulation[ pixel_index + 1u ], integer_color.g );
      atomicAdd( &accumulation[ pixel_index + 2u ], integer_color.b );
      atomicAdd( &accumulation[ pixel_index + 3u ], integer_color.a );
    }
  }
}
