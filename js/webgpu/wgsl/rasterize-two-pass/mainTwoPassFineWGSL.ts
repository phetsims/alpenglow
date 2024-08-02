// Copyright 2024, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { blend_composeWGSL, bounds_clip_edgeWGSL, BufferBindingType, BufferSlot, decimalS, extend_f32WGSL, f32S, F32Type, gamut_map_linear_displayP3WGSL, gamut_map_linear_sRGBWGSL, linear_displayP3_to_linear_sRGBWGSL, linear_sRGB_to_linear_displayP3WGSL, linear_sRGB_to_oklabWGSL, linear_sRGB_to_sRGBWGSL, LinearEdge, LinearEdgeWGSL, logValueWGSL, oklab_to_linear_sRGBWGSL, premultiplyWGSL, RadialGradientType, RenderInstruction, sRGB_to_linear_sRGBWGSL, StorageTextureBindingType, TextureViewSlot, TwoPassConfig, TwoPassFineRenderableFace, TwoPassFineRenderableFaceWGSL, u32S, U32Type, unpremultiplyWGSL, wgsl, wgslBlueprint, WGSLExpressionU32, WGSLMainModule, WGSLSlot } from '../../../imports.js';

export type mainTwoPassFineWGSLOptions = {
  config: BufferSlot<TwoPassConfig>;
  addresses: BufferSlot<number[]>;
  fineRenderableFaces: BufferSlot<TwoPassFineRenderableFace[]>;
  renderProgramInstructions: BufferSlot<number[]>;
  edges: BufferSlot<LinearEdge[]>;
  output: TextureViewSlot;
  storageFormat: GPUTextureFormat; // e.g. deviceContext.preferredStorageFormat
};

const mainTwoPassFineWGSL = (
  options: mainTwoPassFineWGSLOptions
): WGSLMainModule => {

  const configSlot = new WGSLSlot( 'config', options.config, BufferBindingType.UNIFORM );
  const addressesSlot = new WGSLSlot( 'addresses', options.addresses, BufferBindingType.READ_ONLY_STORAGE ); // TODO: see if read-write faster
  const fineRenderableFacesSlot = new WGSLSlot( 'fine_renderable_faces', options.fineRenderableFaces, BufferBindingType.READ_ONLY_STORAGE );
  const renderProgramInstructionsSlot = new WGSLSlot( 'render_program_instructions', options.renderProgramInstructions, BufferBindingType.READ_ONLY_STORAGE );
  const edgesSlot = new WGSLSlot( 'edges', options.edges, BufferBindingType.READ_ONLY_STORAGE );
  const outputSlot = new WGSLSlot( 'output', options.output, new StorageTextureBindingType(
    'write-only',
    options.storageFormat
  ) );

  // TODO options, and test. Maybe allow setting these in the config, SINCE WE KNOW potential stack sizes, or should be able to compute them?
  // TODO: probably can't dynamically size then, hmm
  const stackSize = 10;
  const instructionStackSize = 8;

  // const logIndex = Math.floor( Math.random() * 1000 );
  const logIndex = 4794;
  console.log( logIndex );

  const getInstructionWGSL = ( index: WGSLExpressionU32 ) => wgsl`render_program_instructions[ ${index} ]`;

  // TODO: find a way so that this isn't needed(!)
  const ifLogArguments = wgslBlueprint( blueprint => blueprint.log ? wgsl`, global_id, local_id, workgroup_id` : wgsl`` );
  const ifLogParameters = wgslBlueprint( blueprint => blueprint.log ? wgsl`, global_id: vec3u, local_id: vec3u, workgroup_id: vec3u` : wgsl`` );

  return new WGSLMainModule( [
    configSlot,
    addressesSlot,
    fineRenderableFacesSlot,
    renderProgramInstructionsSlot,
    edgesSlot,
    outputSlot
  ], wgsl`
    const oops_inifinite_loop_code = vec4f( 0.5f, 0.5f, 0f, 0.5f );
    
    const low_area_multiplier = 1e-4f;
    
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
      
      // 21, 13 ish
      
      ${logValueWGSL( {
        value: 'pixel_xy.x',
        type: U32Type,
        lineToLog: line => line.dataArray.flat()[ logIndex ]
      } )}
      ${logValueWGSL( {
        value: 'pixel_xy.y',
        type: U32Type,
        lineToLog: line => line.dataArray.flat()[ logIndex ]
      } )}
              
      let skip_pixel = pixel_xy.x >= config.raster_width || pixel_xy.y >= config.raster_height;
      
      var accumulation = vec4f( 0f, 0f, 0f, 0f );

      //accumulation = vec4( f32( bin_xy.x ) / 16f, 0f, f32( bin_xy.y ) / 16f, 1f ); // TODO: remove
      
      ${logValueWGSL( {
        value: 'next_address',
        type: U32Type,
        lineToLog: line => line.dataArray.flat()[ logIndex ]
      } )}
      
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
        
        ${logValueWGSL( {
          value: 'select( 0u, 1u, skip_pixel )',
          type: U32Type,
          lineToLog: line => line.dataArray.flat()[ logIndex ]
        } )}
        
        let needs_centroid = ( current_face.bits & 0x10000000u ) != 0u;
        let needs_face = ( current_face.bits & 0x20000000u ) != 0u;
        let is_full_area = ( current_face.bits & 0x80000000u ) != 0u;
        let render_program_index = current_face.bits & 0x00ffffffu;
        
        if ( config.filter_type == 0u ) {
          // For non-grid filtering, we don't need uniform control flow, so we can skip pixels
          if ( !skip_pixel ) {
            let bounds_centroid = vec2f( pixel_xy ) + vec2( 0.5f );
            
            let radius_partial = vec2( 0.5f * config.filter_scale );
            
            let min = bounds_centroid - radius_partial;
            let max = bounds_centroid + radius_partial;
            
            accumulate_box( &accumulation, min, max, bounds_centroid, render_program_index, is_full_area, needs_centroid );
          }
        }
        else if ( config.filter_type == 1u ) {
          // TODO: variable-scale bilinear
          // For non-grid filtering, we don't need uniform control flow, so we can skip pixels
          if ( !skip_pixel ) {
            let mid = vec2f( pixel_xy ) + vec2( 0.5f );
            
            let radius_partial = vec2( config.filter_scale );
            
            let min = mid - radius_partial;
            let max = mid + radius_partial;
            
            accumulate_bilinear( &accumulation, min, mid, max, render_program_index, is_full_area, needs_centroid${ifLogArguments} );  
          }
        }
        else if ( config.filter_type == 2u ) {
          // TODO: variable-scale mitchell-netravali
        }
        // TODO: fixed-scale grid clip bilinear/mitchell-netravali
        // TODO: compute all of the integrals (for each section) + ?centroid. compute color with ?centroid.
        // TODO: stuff integrals + color in workgroup memory, barrier, then have each pixel (subset of threads) sum up
      }
      
      ${logValueWGSL( {
        value: 'accumulation.r',
        type: F32Type,
        lineToLog: line => line.dataArray.flat()[ logIndex ]
      } )}
      
      ${logValueWGSL( {
        value: 'accumulation.g',
        type: F32Type,
        lineToLog: line => line.dataArray.flat()[ logIndex ]
      } )}
      
      ${logValueWGSL( {
        value: 'accumulation.b',
        type: F32Type,
        lineToLog: line => line.dataArray.flat()[ logIndex ]
      } )}
      
      ${logValueWGSL( {
        value: 'accumulation.a',
        type: F32Type,
        lineToLog: line => line.dataArray.flat()[ logIndex ]
      } )}
      
      // TODO: do we need the integer scale here?
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
    
    fn accumulate_box(
      accumulation: ptr<function, vec4<f32>>,
      min: vec2f,
      max: vec2f,
      bounds_centroid: vec2f,
      render_program_index: u32,
      is_full_area: bool,
      needs_centroid: bool
    ) {
      var area: f32;
      var centroid: vec2f;
      
      let max_area = ( max.x - min.x ) * ( max.y - min.y );
      
      if ( is_full_area ) {
        area = max_area;
        centroid = bounds_centroid;
      }
      else {
        initialize_box_partials( &area, &centroid, current_face.clip_counts, needs_centroid, min, max, bounds_centroid );
      
        for ( var edge_offset = 0u; edge_offset < current_face.num_edges; edge_offset++ ) {
          // TODO: coalesced reads of this for the future, once we have correctness
          let linear_edge = edges[ current_face.edges_index + edge_offset ];
          
          add_clipped_box_partials( &area, &centroid, linear_edge, needs_centroid, min, max, bounds_centroid );
        }
        
        finalize_box_partials( &area, &centroid, needs_centroid );
      }
      
      if ( area > max_area * low_area_multiplier ) {
        let color = evaluate_render_program_instructions(
          render_program_index,
          centroid,
          bounds_centroid
        );
        
        *accumulation += color * area / max_area;
      }
    }
    
    // TODO: do a grid-based version, since it will need fewer registers AND be 4x faster for compute
    fn accumulate_bilinear(
      accumulation: ptr<function, vec4<f32>>,
      min: vec2f,
      mid: vec2f,
      max: vec2f,
      render_program_index: u32,
      is_full_area: bool,
      needs_centroid: bool
      ${ifLogParameters}
    ) {

      // we have four cells:
      // low-low - x: min -> mid, y: min -> mid (positive sign for integral)
      // low-high - x: min -> mid, y: mid -> max (negative sign for integral - abs flips orientation)
      // high-low - x: mid -> max, y: min -> mid (negative sign for integral - abs flips orientation)
      // high-high - x: mid -> max, y: mid -> max (positive sign for integral)
      
      // values for each cell, indexed as [ low-low, low-high, high-low, high-high ]
      var integrals: array<f32, 4>; // special unit-box coordinate frame (with sign applied)
      var centroids: array<vec2f, 4>; // normal coordinate frame
      
      // unit-box * scale = cell-box (bilinear has 4 cells)
      let scale = mid.y - min.y;
      
      // midpoints for the various cells
      let low = 0.5f * ( min + mid );
      let high = 0.5f * ( mid + max );
      let low_high = vec2( low.x, high.y );
      let high_low = vec2( high.x, low.y );
      
      if ( is_full_area ) {
        integrals = array( 0.25f, 0.25f, 0.25f, 0.25f );
        centroids = array( low, low_high, high_low, high );
      }
      else {
        var areas: array<f32, 4> = array( 0f, 0f, 0f, 0f ); // normal coordinate frame
        integrals = array( 0f, 0f, 0f, 0f );
        centroids = array( vec2( 0f ), vec2f( 0f ), vec2f( 0f ), vec2f( 0f ) );
        
        { // initialize partials by handling each edge
          // low-low
          initialize_bilinear_partial( 
            &areas[ 0 ], &integrals[ 0 ], &centroids[ 0 ], current_face.clip_counts, mid, 1f, scale,
            min, mid, needs_centroid${ifLogArguments}
          );
          
          // low-high
          initialize_bilinear_partial( 
            &areas[ 1 ], &integrals[ 1 ], &centroids[ 1 ], current_face.clip_counts, mid, -1f, scale,
            vec2( min.x, mid.y ), vec2( mid.x, max.y ), needs_centroid${ifLogArguments}
          );
          
          // high-low
          initialize_bilinear_partial( 
            &areas[ 2 ], &integrals[ 2 ], &centroids[ 2 ], current_face.clip_counts, mid, -1f, scale,
            vec2( mid.x, min.y ), vec2( max.x, mid.y ), needs_centroid${ifLogArguments}
          );
          
          // high-high
          initialize_bilinear_partial( 
            &areas[ 3 ], &integrals[ 3 ], &centroids[ 3 ], current_face.clip_counts, mid, 1f, scale,
            mid, max, needs_centroid${ifLogArguments}
          );
        }
        
        for ( var edge_offset = 0u; edge_offset < current_face.num_edges; edge_offset++ ) {
          // TODO: coalesced reads of this for the future, once we have correctness
          let linear_edge = edges[ current_face.edges_index + edge_offset ];
          
          { // low-low
            let result = ${bounds_clip_edgeWGSL( wgsl`linear_edge`, wgsl`min.x`, wgsl`min.y`, wgsl`mid.x`, wgsl`mid.y`, wgsl`low.x`, wgsl`low.y` )};
            
            for ( var i = 0u; i < result.count; i++ ) {
              add_bilinear_partial( &areas[ 0 ], &integrals[ 0 ], &centroids[ 0 ], result.edges[ i ], needs_centroid, mid, 1f, scale, 1f );
            }
          }
          
          { // low-high
            let result = ${bounds_clip_edgeWGSL( wgsl`linear_edge`, wgsl`min.x`, wgsl`mid.y`, wgsl`mid.x`, wgsl`max.y`, wgsl`low_high.x`, wgsl`low_high.y` )};
            
            for ( var i = 0u; i < result.count; i++ ) {
              add_bilinear_partial( &areas[ 1 ], &integrals[ 1 ], &centroids[ 1 ], result.edges[ i ], needs_centroid, mid, -1f, scale, 1f );
            }
          }
          
          { // high-low
            let result = ${bounds_clip_edgeWGSL( wgsl`linear_edge`, wgsl`mid.x`, wgsl`min.y`, wgsl`max.x`, wgsl`mid.y`, wgsl`high_low.x`, wgsl`high_low.y` )};
            
            for ( var i = 0u; i < result.count; i++ ) {
              add_bilinear_partial( &areas[ 2 ], &integrals[ 2 ], &centroids[ 2 ], result.edges[ i ], needs_centroid, mid, -1f, scale, 1f );
            }
          }
          
          { // high-high
            let result = ${bounds_clip_edgeWGSL( wgsl`linear_edge`, wgsl`mid.x`, wgsl`mid.y`, wgsl`max.x`, wgsl`max.y`, wgsl`high.x`, wgsl`high.y` )};
            
            for ( var i = 0u; i < result.count; i++ ) {
              add_bilinear_partial( &areas[ 3 ], &integrals[ 3 ], &centroids[ 3 ], result.edges[ i ], needs_centroid, mid, 1f, scale, 1f );
            }
          }
        }
        
        // box partials are only for centroid
        if ( needs_centroid ) {
          finalize_box_partials( &areas[ 0 ], &centroids[ 0 ], needs_centroid );
          finalize_box_partials( &areas[ 1 ], &centroids[ 1 ], needs_centroid );
          finalize_box_partials( &areas[ 2 ], &centroids[ 2 ], needs_centroid );
          finalize_box_partials( &areas[ 3 ], &centroids[ 3 ], needs_centroid );
        }
      }
      
      // low-low
      if ( integrals[ 0 ] > low_area_multiplier ) {
        let color = evaluate_render_program_instructions(
          render_program_index,
          centroids[ 0 ],
          low
        );
        
        *accumulation += color * integrals[ 0 ];
      }
      
      // low-high
      if ( integrals[ 1 ] > low_area_multiplier ) {
        let color = evaluate_render_program_instructions(
          render_program_index,
          centroids[ 1 ],
          low_high
        );
        
        *accumulation += color * integrals[ 1 ];
      }
      
      // high-low
      if ( integrals[ 2 ] > low_area_multiplier ) {
        let color = evaluate_render_program_instructions(
          render_program_index,
          centroids[ 2 ],
          high_low
        );
        
        *accumulation += color * integrals[ 2 ];
      }
      
      // high-high
      if ( integrals[ 3 ] > low_area_multiplier ) {
        let color = evaluate_render_program_instructions(
          render_program_index,
          centroids[ 3 ],
          high
        );
        
        *accumulation += color * integrals[ 3 ];
      }
    }
    
    fn initialize_box_partials(
      area_partial: ptr<function, f32>,
      centroid_partial: ptr<function, vec2<f32>>,
      packed_clip_counts: u32,
      needs_centroid: bool,
      min: vec2f,
      max: vec2f,
      bounds_centroid: vec2f,
    ) {
      // Initialize based on the edge-clipped counts
      //
      // NOTE: The code below is an optimized form of the below:
      //
      // let minXCount = clip_counts.x;
      // let minYCount = clip_counts.y;
      // let maxXCount = clip_counts.z;
      // let maxYCount = clip_counts.w;
      // area = 2f * ( maxY - minY ) * ( minXCount * minX + maxXCount * maxX ); // double it for when we halve it later
      // centroid = 6f * bounds_centroid * vec2(
      //   ( minX - maxX ) * ( minYCount * minY + maxYCount * maxY ),
      //   ( maxY - minY ) * ( minXCount * minX + maxXCount * maxX )
      // );
    
      let clip_counts = vec4f( unpack4xI8( packed_clip_counts ) );
      
      *area_partial = 2f * ( max.y - min.y ) * ( clip_counts.x * min.x + clip_counts.z * max.x ); // double it for when we halve it later
      
      if ( needs_centroid ) {
        *centroid_partial = 6f * bounds_centroid * vec2(
          ( min.x - max.x ) * ( clip_counts.y * min.y + clip_counts.w * max.y ),
          ( max.y - min.y ) * ( clip_counts.x * min.x + clip_counts.z * max.x )
        );
      }
    }
    
    fn add_box_partial(
      area_partial: ptr<function, f32>,
      centroid_partial: ptr<function, vec2<f32>>,
      edge: ${LinearEdgeWGSL},
      needs_centroid: bool
    ) {
      let p0 = edge.startPoint;
      let p1 = edge.endPoint;
      
      *area_partial += ( p1.x + p0.x ) * ( p1.y - p0.y );
      
      if ( needs_centroid ) {
        let base = p0.x * ( 2f * p0.y + p1.y ) + p1.x * ( p0.y + 2f * p1.y );
        *centroid_partial += base * vec2( p0.x - p1.x, p1.y - p0.y );
      }
    }
    
    // We will need to apply scaled partials when we have edge-clipped counts
    fn add_scaled_box_partial(
      area_partial: ptr<function, f32>,
      centroid_partial: ptr<function, vec2<f32>>,
      edge: ${LinearEdgeWGSL},
      needs_centroid: bool,
      scale: f32
    ) {
      let p0 = edge.startPoint;
      let p1 = edge.endPoint;
      
      *area_partial += scale * ( p1.x + p0.x ) * ( p1.y - p0.y );
      
      if ( needs_centroid ) {
        let base = scale * ( p0.x * ( 2f * p0.y + p1.y ) + p1.x * ( p0.y + 2f * p1.y ) );
        *centroid_partial += base * vec2( p0.x - p1.x, p1.y - p0.y );
      }
    }
    
    fn add_clipped_box_partials(
      area_partial: ptr<function, f32>,
      centroid_partial: ptr<function, vec2<f32>>,
      edge: ${LinearEdgeWGSL},
      needs_centroid: bool,
      min: vec2f,
      max: vec2f,
      bounds_centroid: vec2f,
    ) {
      // TODO: don't require passing so much(!) pointers or inline
      let result = ${bounds_clip_edgeWGSL( wgsl`edge`, wgsl`min.x`, wgsl`min.y`, wgsl`max.x`, wgsl`max.y`, wgsl`bounds_centroid.x`, wgsl`bounds_centroid.y` )};
      
      for ( var i = 0u; i < result.count; i++ ) {
        add_box_partial( area_partial, centroid_partial, result.edges[ i ], needs_centroid );
      }
    }
    
    fn finalize_box_partials(
      area_partial: ptr<function, f32>,
      centroid_partial: ptr<function, vec2<f32>>,
      needs_centroid: bool
    ) {
      *area_partial *= 0.5f;
      if ( needs_centroid && *area_partial > 1e-5 ) {
        *centroid_partial /= 6f * *area_partial;
      }
    }
    
    fn initialize_bilinear_partial(
      area_partial: ptr<function, f32>,
      integral: ptr<function, f32>,
      centroid_partial: ptr<function, vec2<f32>>,
      packed_clip_counts: u32,
      offset: vec2f,
      sign_multiplier: f32,
      scale: f32,
      min: vec2f,
      max: vec2f,
      needs_centroid: bool
      ${ifLogParameters}
    ) {
      // We will manually construct the edges represented by edge-clipped counts, and will then add those as if they were
      // directly provided.
    
      let clip_counts = vec4f( unpack4xI8( packed_clip_counts ) );
      
      // guards should be uniform control flow(!)
      if ( clip_counts[ 0 ] != 0f ) {
        add_bilinear_partial( area_partial, integral, centroid_partial, ${LinearEdgeWGSL}(
          min, vec2( min.x, max.y )
        ), needs_centroid, offset, sign_multiplier, scale, clip_counts[ 0 ] );
      }
      if ( clip_counts[ 1 ] != 0f ) {
        add_bilinear_partial( area_partial, integral, centroid_partial, ${LinearEdgeWGSL}(
          min, vec2( max.x, min.y )
        ), needs_centroid, offset, sign_multiplier, scale, clip_counts[ 1 ] );
      }
      if ( clip_counts[ 2 ] != 0f ) {
        add_bilinear_partial( area_partial, integral, centroid_partial, ${LinearEdgeWGSL}(
          vec2( max.x, min.y ), max
        ), needs_centroid, offset, sign_multiplier, scale, clip_counts[ 2 ] );
      }
      if ( clip_counts[ 3 ] != 0f ) {
        add_bilinear_partial( area_partial, integral, centroid_partial, ${LinearEdgeWGSL}(
          vec2( min.x, max.y ), max
        ), needs_centroid, offset, sign_multiplier, scale, clip_counts[ 3 ] );
      }
    }
  
    fn add_bilinear_partial(
      area_partial: ptr<function, f32>,
      integral: ptr<function, f32>,
      centroid_partial: ptr<function, vec2<f32>>,
      edge: ${LinearEdgeWGSL},
      needs_centroid: bool,
      offset: vec2f, // the "location" of the filter in space, e.g. the pixel we care about
      sign_multiplier: f32, // sometimes not just a sign, integral contribution will be multiplied by this
      scale: f32, // will need to divide by this to put things in the unit box (after offset correction)
      output_scale: f32 // multiplier for the output box (area/centroid) AND bilinear (integral) contributions, likely used for edge-clipped counts
    ) {
      // box partials are only for centroid
      if ( needs_centroid ) {
        // We apply no transformations to the area/centroid computations (normal coordinate space)
        add_scaled_box_partial( area_partial, centroid_partial, edge, needs_centroid, output_scale );
      }
      
      // points scaled into a unit box. if we had an orientation flip, sign_multiplier should be negative
      let p0 = abs( edge.startPoint - offset ) / vec2( scale );
      let p1 = abs( edge.endPoint - offset ) / vec2( scale );
      
      let c01 = p0.x * p1.y;
      let c10 = p1.x * p0.y;
      
      let raw = ( c01 - c10 ) * ( 12f - 4f * ( p0.x + p0.y + p1.x + p1.y ) + 2f * ( p0.x * p0.y + p1.x * p1.y ) + c10 + c01 ) / 24f;
      
      *integral += sign_multiplier * raw * output_scale;
    }
    
    fn evaluate_render_program_instructions(
      render_program_index: u32,
      centroid: vec2f, // only correct if the render program marked as needs centroid
      bounds_centroid: vec2f
    ) -> vec4f {
      var stack: array<vec4f,${decimalS( stackSize )}>;
      var instruction_stack: array<u32,${decimalS( instructionStackSize )}>;
    
      var stack_length = 0u;
      var instruction_stack_length = 0u;
    
      var instruction_address = render_program_index;
      var is_done = false;
    
      var oops_count = 0u;
    
      while ( !is_done ) {
        oops_count++;
        if ( oops_count > 0xfffu ) {
          return oops_inifinite_loop_code;
        }
    
        let start_address = instruction_address;
        let instruction_u32 = ${getInstructionWGSL( wgsl`instruction_address` )};
    
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
          case ${u32S( RenderInstruction.ExitCode )}: {
            is_done = true;
          }
          case ${u32S( RenderInstruction.ReturnCode )}: {
            instruction_stack_length--;
            instruction_address = instruction_stack[ instruction_stack_length ];
          }
          case ${u32S( RenderInstruction.PushCode )}: {
            stack[ stack_length ] = bitcast<vec4<f32>>( vec4(
              ${getInstructionWGSL( wgsl`start_address + 1u` )},
              ${getInstructionWGSL( wgsl`start_address + 2u` )},
              ${getInstructionWGSL( wgsl`start_address + 3u` )},
              ${getInstructionWGSL( wgsl`start_address + 4u` )}
            ) );
            stack_length++;
          }
          case ${u32S( RenderInstruction.StackBlendCode )}: {
            let background = stack[ stack_length - 1u ];
            let foreground = stack[ stack_length - 2u ];
    
            stack_length--;
    
            // Assume premultiplied
            stack[ stack_length - 1u ] = ( 1f - foreground.a ) * background + foreground;
          }
          case ${u32S( RenderInstruction.LinearBlendCode )}: {
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
          case ${u32S( RenderInstruction.OpaqueJumpCode )}: {
            let offset = instruction_u32 >> 8u;
            let color = stack[ stack_length - 1u ];
            if ( color.a >= ${f32S( 1 - 1e-5 )} ) {
              instruction_address = start_address + offset; // jump to offset
            }
          }
          case ${u32S( RenderInstruction.NormalizeCode )}: {
            stack[ stack_length - 1u ] = normalize( stack[ stack_length - 1u ] );
          }
          case ${u32S( RenderInstruction.PremultiplyCode )}: {
            stack[ stack_length - 1u ] = ${premultiplyWGSL( wgsl`stack[ stack_length - 1u ]` )};
          }
          case ${u32S( RenderInstruction.UnpremultiplyCode )}: {
            stack[ stack_length - 1u ] = ${unpremultiplyWGSL( wgsl`stack[ stack_length - 1u ]` )};
          }
          case ${u32S( RenderInstruction.SRGBToLinearSRGBCode )}: {
            let color = stack[ stack_length - 1u ];
            stack[ stack_length - 1u ] = vec4( ${sRGB_to_linear_sRGBWGSL( wgsl`color.rgb` )}, color.a );
          }
          case ${u32S( RenderInstruction.LinearSRGBToSRGBCode )}: {
            let color = stack[ stack_length - 1u ];
            stack[ stack_length - 1u ] = vec4( ${linear_sRGB_to_sRGBWGSL( wgsl`color.rgb` )}, color.a );
          }
          case ${u32S( RenderInstruction.LinearDisplayP3ToLinearSRGBCode )}: {
            let color = stack[ stack_length - 1u ];
            stack[ stack_length - 1u ] = vec4( ${linear_displayP3_to_linear_sRGBWGSL( wgsl`color.rgb` )}, color.a );
          }
          case ${u32S( RenderInstruction.LinearSRGBToLinearDisplayP3Code )}: {
            let color = stack[ stack_length - 1u ];
            stack[ stack_length - 1u ] = vec4( ${linear_sRGB_to_linear_displayP3WGSL( wgsl`color.rgb` )}, color.a );
          }
          case ${u32S( RenderInstruction.OklabToLinearSRGBCode )}: {
            let color = stack[ stack_length - 1u ];
            stack[ stack_length - 1u ] = vec4( ${oklab_to_linear_sRGBWGSL( wgsl`color.rgb` )}, color.a );
          }
          case ${u32S( RenderInstruction.LinearSRGBToOklabCode )}: {
            let color = stack[ stack_length - 1u ];
            stack[ stack_length - 1u ] = vec4( ${linear_sRGB_to_oklabWGSL( wgsl`color.rgb` )}, color.a );
          }
          case ${u32S( RenderInstruction.NormalDebugCode )}: {
            let normal = stack[ stack_length - 1u ];
            stack[ stack_length - 1u ] = vec4( normal.rgb * 0.5f + 0.5f, 1f );
          }
          case ${u32S( RenderInstruction.BlendComposeCode )}: {
            let color_a = stack[ stack_length - 1u ];
            let color_b = stack[ stack_length - 2u ];
            let compose_type = ( instruction_u32 >> 8u ) & 0x7u;
            let blend_type = ( instruction_u32 >> 11u ) & 0xfu;
    
            stack_length--;
    
            stack[ stack_length - 1u ] = ${blend_composeWGSL( wgsl`color_a`, wgsl`color_b`, wgsl`compose_type`, wgsl`blend_type` )};
          }
          case ${u32S( RenderInstruction.MultiplyScalarCode )}: {
            let factor = bitcast<f32>( ${getInstructionWGSL( wgsl`start_address + 1u` )} );
            stack[ stack_length - 1u ] = factor * stack[ stack_length - 1u ];
          }
          case ${u32S( RenderInstruction.ComputeLinearBlendRatioCode )}, ${u32S( RenderInstruction.ComputeRadialBlendRatioCode )}: {
            var t: f32;
    
            let accuracy = instruction_u32 >> 8u;
            let zero_offset = ${getInstructionWGSL( wgsl`start_address + 1u` )};
            let one_offset = ${getInstructionWGSL( wgsl`start_address + 2u` )};
            let blend_offset = ${getInstructionWGSL( wgsl`start_address + 3u` )};
            if ( code == ${u32S( RenderInstruction.ComputeLinearBlendRatioCode )} ) {
              let scaled_normal = bitcast<vec2<f32>>( vec2(
                ${getInstructionWGSL( wgsl`start_address + 4u` )},
                ${getInstructionWGSL( wgsl`start_address + 5u` )}
              ) );
              let offset = bitcast<f32>( ${getInstructionWGSL( wgsl`start_address + 6u` )} );
    
              let centroid = select( bounds_centroid, centroid, accuracy == 0u );
              let dot_product = dot( scaled_normal, centroid );
              t = dot_product - offset;
            }
            else {
              let inverse_transform = mat3x3(
                bitcast<f32>( ${getInstructionWGSL( wgsl`start_address + 4u` )} ),
                bitcast<f32>( ${getInstructionWGSL( wgsl`start_address + 7u` )} ),
                0f,
                bitcast<f32>( ${getInstructionWGSL( wgsl`start_address + 5u` )} ),
                bitcast<f32>( ${getInstructionWGSL( wgsl`start_address + 8u` )} ),
                0f,
                bitcast<f32>( ${getInstructionWGSL( wgsl`start_address + 6u` )} ),
                bitcast<f32>( ${getInstructionWGSL( wgsl`start_address + 9u` )} ),
                1f
              );
              let radius0 = bitcast<f32>( ${getInstructionWGSL( wgsl`start_address + 10u` )} );
              let radius1 = bitcast<f32>( ${getInstructionWGSL( wgsl`start_address + 11u` )} );
    
              var average_distance: f32;
    
              if ( accuracy == 0u ) {
                // TODO: evaluate the integral!!!!!
                let localPoint = inverse_transform * vec3( centroid, 1f );
                average_distance = length( localPoint );
              }
              else {
                let centroid = select( bounds_centroid, centroid, accuracy == 1u );
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
          case ${u32S( RenderInstruction.ComputeLinearGradientRatioCode )}, ${u32S( RenderInstruction.ComputeRadialGradientRatioCode )}: {
            let is_linear = code == ${u32S( RenderInstruction.ComputeLinearGradientRatioCode )};
    
            let accuracy = ( instruction_u32 >> 8u ) & 0x7u;
            let extend = ( instruction_u32 >> 11u ) & 0x2u;
            let ratio_count = instruction_u32 >> 16u;
    
            let transform = mat3x3(
              bitcast<f32>( ${getInstructionWGSL( wgsl`start_address + 1u` )} ),
              bitcast<f32>( ${getInstructionWGSL( wgsl`start_address + 4u` )} ),
              0f,
              bitcast<f32>( ${getInstructionWGSL( wgsl`start_address + 2u` )} ),
              bitcast<f32>( ${getInstructionWGSL( wgsl`start_address + 5u` )} ),
              0f,
              bitcast<f32>( ${getInstructionWGSL( wgsl`start_address + 3u` )} ),
              bitcast<f32>( ${getInstructionWGSL( wgsl`start_address + 6u` )} ),
              1f
            );
    
            var t: f32;
            if ( is_linear ) {
              let inverse_transform = transform;
              let start = bitcast<vec2<f32>>( vec2(
                  ${getInstructionWGSL( wgsl`start_address + 7u` )},
                  ${getInstructionWGSL( wgsl`start_address + 8u` )}
              ) );
              let grad_delta = bitcast<vec2<f32>>( vec2(
                  ${getInstructionWGSL( wgsl`start_address + 9u` )},
                  ${getInstructionWGSL( wgsl`start_address + 10u` )}
              ) );
    
              let centroid = select( bounds_centroid, centroid, accuracy == 0u || accuracy == 2u );
    
              let local_point = ( inverse_transform * vec3( centroid, 1f ) ).xy;
              let local_delta = local_point - start;
    
              let raw_t = select( 0f, dot( local_delta, grad_delta ) / dot( grad_delta, grad_delta ), length( grad_delta ) > 0f, );
    
              t = ${extend_f32WGSL( wgsl`raw_t`, wgsl`extend` )};
            }
            else {
              let kind = ( instruction_u32 >> 13u ) & 0x3u;
              let is_swapped = ( ( instruction_u32 >> 15u ) % 0x1u ) != 0u;
              let conic_transform = transform;
              let focal_x = bitcast<f32>( ${getInstructionWGSL( wgsl`start_address + 7u` )} );
              let radius = bitcast<f32>( ${getInstructionWGSL( wgsl`start_address + 8u` )} );

              let is_strip = kind == ${u32S( RadialGradientType.Strip )};
              let is_circular = kind == ${u32S( RadialGradientType.Circular )};
              let is_focal_on_circle = kind == ${u32S( RadialGradientType.FocalOnCircle )};
              let r1_recip = select( 1.f / radius, 0f, is_circular );
              let less_scale = select( 1f, -1f, is_swapped || ( 1f - focal_x ) < 0f );
              let t_sign = sign( 1f - focal_x );
    
              // TODO: centroid handling for this
              let centroid = select( bounds_centroid, centroid, accuracy == 0u || accuracy == 1u || accuracy == 3u );
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
                t = ${extend_f32WGSL( wgsl`focal_x + t_sign * t`, wgsl`extend` )};
                if ( is_swapped ) {
                  t = 1f - t;
                }
              }
            }
    
            let blend_offset = select( 9u, 11u, is_linear );
            let stops_offset = blend_offset + 1u; // ratio, stopOffset pairs
    
            let blend_address = start_address + ${getInstructionWGSL( wgsl`start_address + blend_offset` )};
    
            var i = -1i;
            while (
              i < i32( ratio_count ) - 1i &&
              bitcast<f32>( ${getInstructionWGSL( wgsl`start_address + stops_offset + 2u * u32( i + 1i )` )} ) < t
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
              instruction_address = start_address + ${getInstructionWGSL( wgsl`start_address + stops_offset + 1u` )};
            }
            else if ( i == i32( ratio_count ) - 1i ) {
              stack[ stack_length ] = vec4( 1f, 0f, 0f, 0f ); // number 1, for t
              stack[ stack_length + 1u ] = vec4( 0f, 0f, 0f, 0f ); // spacer
              stack_length += 2;
    
              // call stopLocations[ i ]
              instruction_stack[ instruction_stack_length ] = instruction_address;
              instruction_stack_length++;
              instruction_address = start_address + ${getInstructionWGSL( wgsl`start_address + stops_offset + 2u * u32( i ) + 1u` )};
            }
            else {
              // TODO: create stops_address to factor out these additions!
              let ratio_before = bitcast<f32>( ${getInstructionWGSL( wgsl`start_address + stops_offset + 2u * u32( i )` )} );
              let ratio_after = bitcast<f32>( ${getInstructionWGSL( wgsl`start_address + stops_offset + 2u * u32( i + 1i )` )} );
    
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
                instruction_address = start_address + ${getInstructionWGSL( wgsl`start_address + stops_offset + 2u * u32( i ) + 1u` )};
              }
    
              if ( hasAfter ) {
                // call stopLocations[ i + 1 ]
                instruction_stack[ instruction_stack_length ] = instruction_address;
                instruction_stack_length++;
                instruction_address = start_address + ${getInstructionWGSL( wgsl`start_address + stops_offset + 2u * u32( i + 1i ) + 1u` )};
              }
            }
          }
          case ${u32S( RenderInstruction.BarycentricBlendCode )}, ${u32S( RenderInstruction.BarycentricPerspectiveBlendCode )}: {
            let accuracy = instruction_u32 >> 8u;
    
            let det = bitcast<f32>( ${getInstructionWGSL( wgsl`start_address + 1u` )} );
            let diff_a = bitcast<vec2<f32>>( vec2(
              ${getInstructionWGSL( wgsl`start_address + 2u` )},
              ${getInstructionWGSL( wgsl`start_address + 3u` )}
            ) );
            let diff_b = bitcast<vec2<f32>>( vec2(
              ${getInstructionWGSL( wgsl`start_address + 4u` )},
              ${getInstructionWGSL( wgsl`start_address + 5u` )}
            ) );
            let point_c = bitcast<vec2<f32>>( vec2(
              ${getInstructionWGSL( wgsl`start_address + 6u` )},
              ${getInstructionWGSL( wgsl`start_address + 7u` )}
            ) );
    
            let color_a = stack[ stack_length - 1u ];
            let color_b = stack[ stack_length - 2u ];
            let color_c = stack[ stack_length - 3u ];
    
            stack_length -= 2u;
    
            let point = select( bounds_centroid, centroid, accuracy == 0u );
    
            let lambda_a = dot( diff_a, point - point_c ) / det;
            let lambda_b = dot( diff_b, point - point_c ) / det;
            let lambda_c = 1f - lambda_a - lambda_b;
    
            if ( code == ${u32S( RenderInstruction.BarycentricBlendCode )} ) {
              stack[ stack_length - 1u ] = color_a * lambda_a + color_b * lambda_b + color_c * lambda_c;
            }
            // Perspective-correction
            else {
              let z_inverse_a = lambda_a * bitcast<f32>( ${getInstructionWGSL( wgsl`start_address + 8u` )} );
              let z_inverse_b = lambda_b * bitcast<f32>( ${getInstructionWGSL( wgsl`start_address + 9u` )} );
              let z_inverse_c = lambda_c * bitcast<f32>( ${getInstructionWGSL( wgsl`start_address + 10u` )} );
    
              stack[ stack_length - 1u ] = (
                color_a * z_inverse_a +
                color_b * z_inverse_b +
                color_c * z_inverse_c
              ) / ( z_inverse_a + z_inverse_b + z_inverse_c );
            }
          }
          case ${u32S( RenderInstruction.FilterCode )}: {
            // TODO: don't require a transpose here, just do it
            let matrix = transpose( mat4x4(
              bitcast<f32>( ${getInstructionWGSL( wgsl`start_address + 1u` )} ),
              bitcast<f32>( ${getInstructionWGSL( wgsl`start_address + 2u` )} ),
              bitcast<f32>( ${getInstructionWGSL( wgsl`start_address + 3u` )} ),
              bitcast<f32>( ${getInstructionWGSL( wgsl`start_address + 4u` )} ),
              bitcast<f32>( ${getInstructionWGSL( wgsl`start_address + 5u` )} ),
              bitcast<f32>( ${getInstructionWGSL( wgsl`start_address + 6u` )} ),
              bitcast<f32>( ${getInstructionWGSL( wgsl`start_address + 7u` )} ),
              bitcast<f32>( ${getInstructionWGSL( wgsl`start_address + 8u` )} ),
              bitcast<f32>( ${getInstructionWGSL( wgsl`start_address + 9u` )} ),
              bitcast<f32>( ${getInstructionWGSL( wgsl`start_address + 10u` )} ),
              bitcast<f32>( ${getInstructionWGSL( wgsl`start_address + 11u` )} ),
              bitcast<f32>( ${getInstructionWGSL( wgsl`start_address + 12u` )} ),
              bitcast<f32>( ${getInstructionWGSL( wgsl`start_address + 13u` )} ),
              bitcast<f32>( ${getInstructionWGSL( wgsl`start_address + 14u` )} ),
              bitcast<f32>( ${getInstructionWGSL( wgsl`start_address + 15u` )} ),
              bitcast<f32>( ${getInstructionWGSL( wgsl`start_address + 16u` )} )
            ) );
    
            let translation = bitcast<vec4<f32>>( vec4(
              ${getInstructionWGSL( wgsl`start_address + 17u` )},
              ${getInstructionWGSL( wgsl`start_address + 18u` )},
              ${getInstructionWGSL( wgsl`start_address + 19u` )},
              ${getInstructionWGSL( wgsl`start_address + 20u` )}
            ) );
    
            stack[ stack_length - 1u ] = matrix * stack[ stack_length - 1u ] + translation;
          }
          // TODO: ImageCode
          case ${u32S( RenderInstruction.PhongCode )}: {
            let alpha = bitcast<f32>( ${getInstructionWGSL( wgsl`start_address + 1u` )} );
            let num_lights = ${getInstructionWGSL( wgsl`start_address + 2u` )};
    
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
  ` );
};

export default mainTwoPassFineWGSL;