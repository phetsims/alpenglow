// Copyright 2024, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { blend_composeWGSL, bounds_clip_edgeWGSL, BufferBindingType, BufferSlot, decimalS, extend_f32WGSL, f32S, gamut_map_linear_displayP3WGSL, gamut_map_linear_sRGBWGSL, linear_displayP3_to_linear_sRGBWGSL, linear_sRGB_to_linear_displayP3WGSL, linear_sRGB_to_oklabWGSL, linear_sRGB_to_sRGBWGSL, LinearEdge, oklab_to_linear_sRGBWGSL, premultiplyWGSL, RadialGradientType, RenderInstruction, sRGB_to_linear_sRGBWGSL, StorageTextureBindingType, TextureViewSlot, TwoPassConfig, TwoPassFineRenderableFace, TwoPassFineRenderableFaceWGSL, u32S, unpremultiplyWGSL, wgsl, WGSLExpressionU32, WGSLMainModule, WGSLSlot } from '../../../imports.js';

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

  const getInstructionWGSL = ( index: WGSLExpressionU32 ) => wgsl`render_program_instructions[ ${index} ]`;

  return new WGSLMainModule( [
    configSlot,
    addressesSlot,
    fineRenderableFacesSlot,
    renderProgramInstructionsSlot,
    edgesSlot,
    outputSlot
  ], wgsl`
    const oops_inifinite_loop_code = vec4f( 0.5f, 0.5f, 0f, 0.5f );
    
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
        
        //let last_address = next_address;
        
        if ( local_id.x == 0u ) {
          current_face = fine_renderable_faces[ next_address ];
          next_address = current_face.next_address;
        }
        
        workgroupBarrier();
        
        if ( !skip_pixel ) {
          //let needs_centroid = ( current_face.bits & 0x10000000u ) != 0u;
          let needs_centroid = true; // TODO: remove
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
          
          let render_program_index = current_face.bits & 0x00ffffffu;
          
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
          
          if ( area > 1e-4f ) {
            let color = evaluate_render_program_instructions(
              render_program_index,
              centroid,
              bounds_centroid
            );
            
            accumulation += color * area;
            
            // if ( oops_count == 1u ) {
            //   accumulation += color * area;
            // }
            
            //accumulation = vec4( select( 0f, 1f, area > 0.5f ), select( 0f, 1f, color.a > 0.5f ), 0f, 1f );
          }
          
          
          //if ( accumulation.a < 1e-8f ) {
          //  accumulation += color * area;
          //}
          //accumulation = color * area;
          //if ( area > 1e-8f ) {
          //  accumulation = vec4( ( centroid / vec2f( 512f ) ), 0f, 1f ) * area;
          //}
          
          //accumulation += color * area;
          //accumulation = vec4( 1f, 0f, area, 1f );
          //accumulation = color;
          //accumulation = vec4( select( 0f, 1f, area > 0.5f ), select( 0f, 1f, color.a > 0.5f ), 0f, 1f );
          //accumulation += vec4( 0f, 0f, 0f, area ); // TODO: remove
          //accumulation += vec4( f32( last_address ) / 1000f * area, 0f, 0f, area ); // TODO: remove
          //accumulation += vec4( f32( render_program_index ) / 1000f * area, 0f, 0f, area ); // TODO: remove
          //accumulation = vec4( select( 0f, 1f, maxXCount < 0f ), 0f, 0f, 1f ); // TODO: remove
          //accumulation = vec4( minXCount * 0.5f + 0.5f, maxXCount * 0.5f + 0.5f, minYCount * 0.5f + 0.5f, 1f ); // TODO: remove
        }
      }
      
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
    
    fn evaluate_render_program_instructions(
      render_program_index: u32,
      centroid: vec2f,
      bounds_centroid: vec2f
    ) -> vec4f {
      var stack: array<vec4f,${decimalS( stackSize )}>;
      var instruction_stack: array<u32,${decimalS( instructionStackSize )}>;
    
      var stack_length = 0u;
      var instruction_stack_length = 0u;
    
      var instruction_address = render_program_index;
      var is_done = false;
    
      var oops_count = 0u;
    
      var fake_centroid = bounds_centroid;
      var real_centroid = centroid;
    
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
    
              let centroid = select( fake_centroid, real_centroid, accuracy == 0u );
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
    
              let centroid = select( fake_centroid, real_centroid, accuracy == 0u || accuracy == 2u );
    
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
    
            let point = select( fake_centroid, real_centroid, accuracy == 0u );
    
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