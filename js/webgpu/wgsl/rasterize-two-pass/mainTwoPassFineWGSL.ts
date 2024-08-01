// Copyright 2024, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { bounds_clip_edgeWGSL, BufferBindingType, BufferSlot, f32S, gamut_map_linear_displayP3WGSL, gamut_map_linear_sRGBWGSL, linear_sRGB_to_sRGBWGSL, LinearEdge, premultiplyWGSL, StorageTextureBindingType, TextureViewSlot, TwoPassConfig, TwoPassFineRenderableFace, TwoPassFineRenderableFaceWGSL, unpremultiplyWGSL, wgsl, WGSLMainModule, WGSLSlot } from '../../../imports.js';

export type mainTwoPassFineWGSLOptions = {
  config: BufferSlot<TwoPassConfig>;
  addresses: BufferSlot<number[]>;
  fineRenderableFaces: BufferSlot<TwoPassFineRenderableFace[]>;
  edges: BufferSlot<LinearEdge[]>;
  output: TextureViewSlot;
  storageFormat: GPUTextureFormat; // e.g. deviceContext.preferredStorageFormat
  integerScale: number;
};

const mainTwoPassFineWGSL = (
  options: mainTwoPassFineWGSLOptions
): WGSLMainModule => {

  const configSlot = new WGSLSlot( 'config', options.config, BufferBindingType.UNIFORM );
  const addressesSlot = new WGSLSlot( 'addresses', options.addresses, BufferBindingType.READ_ONLY_STORAGE ); // TODO: see if read-write faster
  const fineRenderableFacesSlot = new WGSLSlot( 'fine_renderable_faces', options.fineRenderableFaces, BufferBindingType.READ_ONLY_STORAGE );
  const edgesSlot = new WGSLSlot( 'edges', options.edges, BufferBindingType.READ_ONLY_STORAGE );
  const outputSlot = new WGSLSlot( 'output', options.output, new StorageTextureBindingType(
    'write-only',
    options.storageFormat
  ) );

  return new WGSLMainModule( [
    configSlot,
    addressesSlot,
    fineRenderableFacesSlot,
    edgesSlot,
    outputSlot
  ], wgsl`
    const oops_inifinite_loop_code = vec4f( 1f, 1f, 0f, 0.5f );
    
    var<workgroup> bin_xy: vec2<u32>;
    var<workgroup> workgroup_exit: bool;
    var<workgroup> next_address: u32;
    var<workgroup> current_face: ${TwoPassFineRenderableFaceWGSL};
    
    @compute @workgroup_size(256)
    fn main(
      @builtin(global_invocation_id) global_id: vec3u,
      @builtin(local_invocation_id) local_id: vec3u,
      @builtin(workgroup_id) workgroup_id: vec3u
    ) {
      // TODO: see if we should do all of this "workgroup-common" logic in one thread, then barrier.
    
      if ( local_id.x == 0u ) {
        let bin_index = workgroup_id.x;
        
        let tile_index = bin_index >> 8u;
        let tile_xy = vec2( tile_index % config.tile_width, tile_index / config.tile_width );
        
        // upper-left of the tile, in "bin" coordinates
        let base_bin_xy = vec2( 16u ) * tile_xy;
        
        let sub_bin_index = bin_index & 0xffu;
        
        // "bin" coordinates
        bin_xy = base_bin_xy + vec2( sub_bin_index % 16u, sub_bin_index / 16u );
        
        next_address = addresses[ bin_index + 2u ]; // make space for the two allocators
        
        workgroup_exit = bin_xy.x >= config.bin_width || bin_xy.y >= config.bin_height;
      }
      
      workgroupBarrier();
      
      if ( workgroupUniformLoad( &workgroup_exit ) ) {
        return;
      }
      
      let pixel_xy = bin_xy * config.bin_size + vec2( local_id.x % 16u, local_id.x / 16u );
      
      let skip_pixel = pixel_xy.x >= config.raster_width || pixel_xy.y >= config.raster_height;
      
      var accumulation = vec4f( 0f, 0f, 0f, 0f );

      //accumulation = vec4( f32( bin_xy.x ) / 16f, 0f, f32( bin_xy.y ) / 16f, 1f ); // TODO: remove
      
      var oops_count = 0u;
      while ( workgroupUniformLoad( &next_address ) != 0xffffffffu ) {
        oops_count++;
        if ( oops_count > 0xfffu ) {
          accumulation = oops_inifinite_loop_code;
          break;
        }
        
        if ( local_id.x == 0u ) {
          current_face = fine_renderable_faces[ next_address ];
          next_address = current_face.next_address;
        }
        
        workgroupBarrier();
        
        if ( !skip_pixel ) {
          let needs_centroid = ( current_face.bits & 0x10000000u ) != 0u;
          let needs_face = ( current_face.bits & 0x20000000u ) != 0u;
          let is_full_area = ( current_face.bits & 0x80000000u ) != 0u;
          
          var area: f32;
          var centroid: vec2f;
          
          let bounds_centroid = vec2f( pixel_xy ) + vec2( 0.5f );
          let clip_counts = unpack4xI8( current_face.clip_counts );
          
          // TODO: optimize for registers, if it isn't allocating registers and reordering nicely
          // TODO: move these inside more
          let minXCount = f32( clip_counts.x );
          let minYCount = f32( clip_counts.y );
          let maxXCount = f32( clip_counts.z );
          let maxYCount = f32( clip_counts.w );
          let minX = f32( pixel_xy.x );
          let minY = f32( pixel_xy.y );
          let maxX = f32( pixel_xy.x + 1u );
          let maxY = f32( pixel_xy.y + 1u );
          
          if ( is_full_area ) {
            area = 1f;
            centroid = bounds_centroid;
          }
          else {
            
            // We will sum up partials. First we will initialize based on the edge-clipped counts
            area = 2f * ( maxY - minY ) * ( minXCount * minX + maxXCount * maxX ); // double it for when we halve it later
            if ( needs_centroid ) {
              centroid = 6f * bounds_centroid * vec2(
                ( minX - maxX ) * ( minYCount * minY + maxYCount * maxY ),
                ( maxY - minY ) * ( minXCount * minX + maxXCount * maxX )
              );
            }
            else {
              centroid = bounds_centroid;
            }
            
            for ( var edge_offset = 0u; edge_offset < current_face.num_edges; edge_offset++ ) {
              let edge_index = current_face.edges_index + edge_offset;
              
              // TODO: coalesced reads of this for the future, once we have correctness
              let linear_edge = edges[ edge_index ];
              
              // TODO: don't require passing so much(!) pointers or inline
              let result = ${bounds_clip_edgeWGSL( wgsl`linear_edge`, wgsl`minX`, wgsl`minY`, wgsl`maxX`, wgsl`maxY`, wgsl`bounds_centroid.x`, wgsl`bounds_centroid.y` )};
              
              for ( var i = 0u; i < result.count; i++ ) {
                let p0x = result.edges[ i ].startPoint.x;
                let p0y = result.edges[ i ].startPoint.y;
                let p1x = result.edges[ i ].endPoint.x;
                let p1y = result.edges[ i ].endPoint.y;
                
                area += ( p1x + p0x ) * ( p1y - p0y );
                
                if ( needs_centroid ) {
                  let base = p0x * ( 2f * p0y + p1y ) + p1x * ( p0y + 2f * p1y );
                  centroid += base * vec2( p0x - p1x, p1y - p0y );
                }
              }
            }
            
            area *= 0.5f;
            if ( needs_centroid ) {
              centroid /= 6f * area;
            }
          
            // TODO: load the edge data (possibly in coalesced reads)
            // TODO: iterate through, computing the area and centroid
            // TODO: (handle needs_face??)
          }
          
          accumulation += vec4( 0f, 0f, 0f, area ); // TODO: remove
          //accumulation = vec4( select( 0f, 1f, maxXCount < 0f ), 0f, 0f, 1f ); // TODO: remove
          //accumulation = vec4( minXCount * 0.5f + 0.5f, maxXCount * 0.5f + 0.5f, minYCount * 0.5f + 0.5f, 1f ); // TODO: remove
        }
      }
      
      // TODO: do we need the integer scale here?
      //let linear_unmapped_color = ${unpremultiplyWGSL( wgsl`accumulation * vec4( ${f32S( 1 / options.integerScale )} )` )};
      let linear_unmapped_color = ${unpremultiplyWGSL( wgsl`accumulation` )};
    
      var output_color = vec4( 0f );
      if ( linear_unmapped_color.a > 1e-8f ) {
        switch ( config.raster_color_space ) {
          case 0u: {
            output_color = vec4(
              ${linear_sRGB_to_sRGBWGSL( gamut_map_linear_sRGBWGSL( wgsl`linear_unmapped_color.rgb` ) )},
              min( 1f, linear_unmapped_color.a )
            );
          }
          case 1u: {
            output_color = vec4(
              ${linear_sRGB_to_sRGBWGSL( gamut_map_linear_displayP3WGSL( wgsl`linear_unmapped_color.rgb` ) )},
              min( 1f, linear_unmapped_color.a )
            );
          }
          default: {
            output_color = vec4( 1f, 0.5f, 0.111111, 1f );
          }
        }
      }
      
      textureStore( output, vec2( pixel_xy.x, pixel_xy.y ), ${premultiplyWGSL( wgsl`output_color` )} );
    }
  ` );
};

export default mainTwoPassFineWGSL;