// Copyright 2023-2024, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { BufferBindingType, BufferSlot, f32S, gamut_map_linear_displayP3WGSL, gamut_map_linear_sRGBWGSL, linear_sRGB_to_sRGBWGSL, premultiplyWGSL, StorageTextureBindingType, TextureViewSlot, TwoPassConfig, TwoPassFineRenderableFace, TwoPassFineRenderableFaceWGSL, unpremultiplyWGSL, wgsl, WGSLMainModule, WGSLSlot } from '../../../imports.js';

export type mainTwoPassFineWGSLOptions = {
  config: BufferSlot<TwoPassConfig>;
  addresses: BufferSlot<number[]>;
  fineRenderableFaces: BufferSlot<TwoPassFineRenderableFace[]>;
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
  const outputSlot = new WGSLSlot( 'output', options.output, new StorageTextureBindingType(
    'write-only',
    options.storageFormat
  ) );

  return new WGSLMainModule( [
    configSlot,
    addressesSlot,
    fineRenderableFacesSlot,
    outputSlot
  ], wgsl`
    const oops_inifinite_loop_code = vec4f( 1f, 1f, 0f, 0.5f );
    
    var<workgroup> bin_xy: vec2<u32>;
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
        bin_xy = vec2( base_bin_x + ( sub_bin_index % 16u ), base_bin_y + ( sub_bin_index / 16u ) );
      }
      
      workgroupBarrier();
      
      if ( bin_xy.x >= config.bin_width || bin_xy.y >= config.bin_height ) {
        return;
      }
      
      let pixel_x = bin_x * config.bin_size + ( local_id.x % 16u );
      let pixel_y = bin_y * config.bin_size + ( local_id.x / 16u );
      
      // TODO: we should be able to rearrange these so we get workgroups to exit warps slightly earlier
      if ( pixel_x >= config.raster_width || pixel_y >= config.raster_height ) {
        return;
      }
      
      if ( local_id.x == 0u ) {
        next_address = addresses[ bin_index + 2u ]; // make space for the two allocators
      }
      
      workgroupBarrier();
      
      var accumulation = vec4f( 0f, 0f, 0f, 0f );
      
      var oops_count = 0u;
      while ( next_address != 0xffffffffu ) {
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
      
      textureStore( output, vec2( pixel_x, pixel_y ), ${premultiplyWGSL( wgsl`output_color` )} );
    }
  ` );
};

export default mainTwoPassFineWGSL;