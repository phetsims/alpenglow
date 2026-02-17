// Copyright 2024-2025, University of Colorado Boulder

/**
 * TODO: doc
 *
 * Should be dispatched with one workgroup PER coarse renderable face (one thread per face-X-bin).
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import optionize from '../../../../../phet-core/js/optionize.js';
import { BufferSlot } from '../../compute/BufferSlot.js';
import { TwoPassConfig } from './TwoPassConfig.js';
import { TwoPassCoarseRenderableFace } from './TwoPassCoarseRenderableFace.js';
import { LinearEdge } from '../../../cag/LinearEdge.js';
import { TwoPassFineRenderableFace } from './TwoPassFineRenderableFace.js';
import { wgsl, WGSLExpressionU32, WGSLMainModule, WGSLSlot } from '../WGSLString.js';
import { BufferBindingType } from '../../compute/BufferBindingType.js';
import { TwoPassCoarseRenderableFaceWGSL } from './TwoPassCoarseRenderableFaceWGSL.js';
import { bounds_clip_edgeWGSL } from '../clip/bounds_clip_edgeWGSL.js';
import { scanWGSL } from '../gpu/scanWGSL.js';
import { Vec2uAdd } from '../../compute/ConcreteType.js';
import { TwoPassFineRenderableFaceWGSL } from './TwoPassFineRenderableFaceWGSL.js';

export type mainTwoPassCoarseWGSLOptions = {
  // input
  config: BufferSlot<TwoPassConfig>;
  coarseRenderableFaces: BufferSlot<TwoPassCoarseRenderableFace[]>;
  coarseEdges: BufferSlot<LinearEdge[]>;

  // output
  fineRenderableFaces: BufferSlot<TwoPassFineRenderableFace[]>;
  fineEdges: BufferSlot<LinearEdge[]>;
  addresses: BufferSlot<number[]>; // note: first atomic is face-allocation, second is edge-allocation

  numCoarseRenderableFaces: WGSLExpressionU32;
};

export const MAIN_TWO_PASS_COARSE_DEFAULTS = {
  // placeholder
} as const;

export const mainTwoPassCoarseWGSL = (
  providedOptions: mainTwoPassCoarseWGSLOptions
): WGSLMainModule => {

  const options = optionize<mainTwoPassCoarseWGSLOptions>()( {

  }, providedOptions );

  const configSlot = new WGSLSlot( 'config', options.config, BufferBindingType.UNIFORM );
  const coarseRenderableFacesSlot = new WGSLSlot( 'coarse_renderable_faces', options.coarseRenderableFaces, BufferBindingType.READ_ONLY_STORAGE );
  const coarseEdgesSlot = new WGSLSlot( 'coarse_edges', options.coarseEdges, BufferBindingType.READ_ONLY_STORAGE );

  const fineRenderableFacesSlot = new WGSLSlot( 'fine_renderable_faces', options.fineRenderableFaces, BufferBindingType.STORAGE );
  const fineEdgesSlot = new WGSLSlot( 'fine_edges', options.fineEdges, BufferBindingType.STORAGE );
  const addressesSlot = new WGSLSlot( 'addresses', options.addresses, BufferBindingType.STORAGE );

  return new WGSLMainModule( [
    configSlot,
    coarseRenderableFacesSlot,
    coarseEdgesSlot,
    fineRenderableFacesSlot,
    fineEdgesSlot,
    addressesSlot
  ], wgsl`
    const low_area_multiplier = 0.0002f;
    
    var<workgroup> coarse_face: ${TwoPassCoarseRenderableFaceWGSL};
    var<workgroup> scratch_data: array<vec2u, 256>;
    var<workgroup> base_indices: vec2u;
    
    @compute @workgroup_size(256)
    fn main(
      @builtin(global_invocation_id) global_id: vec3u,
      @builtin(local_invocation_id) local_id: vec3u,
      @builtin(workgroup_id) workgroup_id: vec3u
    ) {
      // Ensure we exit early if we don't contain valid data
      if ( workgroup_id.x >= ${options.numCoarseRenderableFaces} ) {
        return;
      }
    
      if ( local_id.x == 0u ) {
        // TODO: RANGE CHECK this
        coarse_face = coarse_renderable_faces[ workgroup_id.x ];
      }
      
      workgroupBarrier();
      
      let tile_index_xy = vec2(
        coarse_face.tile_index % config.tile_width,
        coarse_face.tile_index / config.tile_width
      );
      
      let tile_xy = tile_index_xy * vec2( config.tile_size );
      
      let relative_bin_xy = vec2( local_id.x % 16u, local_id.x / 16u );
      
      let filter_expansion = select( select( 2f, 1f, config.filter_type == 1u ), 0.5f, config.filter_type == 0u ) * config.filter_scale - 0.5f;
      
      let min = vec2f( tile_xy + vec2( config.bin_size ) * relative_bin_xy ) - vec2( filter_expansion ); 
      let max = vec2f( tile_xy + vec2( config.bin_size ) * ( vec2( 1u ) + relative_bin_xy ) ) + vec2( filter_expansion );
      
      var area: f32;
      var num_clipped_edges: u32 = 0u;
      var clipped_clip_counts = unpack4xI8( coarse_face.clip_counts );
      
      let max_area = ( max.x - min.x ) * ( max.y - min.y );
      
      let is_source_full_area = ( coarse_face.bits & 0x80000000u ) != 0u;
      
      if ( is_source_full_area ) {
        area = max_area;
      }
      else {
        let source_clip_counts = vec4f( clipped_clip_counts );
        
        // Initialize area partial
        area = 2f * ( max.y - min.y ) * ( source_clip_counts.x * min.x + source_clip_counts.z * max.x ); // double it for when we halve it later
        
        // Accumulate to area partial
        for ( var edge_offset = 0u; edge_offset < coarse_face.num_edges; edge_offset++ ) {
          // TODO: coalesced reads of this for the future, once we have correctness
          let linear_edge = coarse_edges[ coarse_face.edges_index + edge_offset ];
          
          let bounds_centroid = 0.5f * ( min + max );
          let result = ${bounds_clip_edgeWGSL( wgsl`linear_edge`, wgsl`min.x`, wgsl`min.y`, wgsl`max.x`, wgsl`max.y`, wgsl`bounds_centroid.x`, wgsl`bounds_centroid.y` )};
          
          for ( var i = 0u; i < result.count; i++ ) {
            let edge = result.edges[ i ];
          
            let p0 = edge.startPoint;
            let p1 = edge.endPoint;
            
            area += ( p1.x + p0.x ) * ( p1.y - p0.y );
            
            if ( is_edge_clipped_count( p0, p1, min, max ) ) {
              // TODO: consider NOT writing the clip counts in this (hopefully faster) loop?
              // TODO: would require writing the face AFTER the edges (waiting for 2nd pass)
              
              // sum should only increase if we are adding a count
              let count_delta = select( -1i, 1i, p0.x + p0.y < p1.x + p1.y );
              let index = select( select( 3u, 1u, p0.y == min.y ), select( 2u, 0u, p0.x == min.x ), p0.x == p1.x );
              clipped_clip_counts[ index ] += count_delta;
            }
            else {
              // If we aren't a count, we'll need to output the edge
              num_clipped_edges += 1u;
            }
          }
        }
        
        // Finalize area partial
        area *= 0.5f;
      }
      
      // TODO: don't use low_area_multiplier with full area!
      let is_full_area = is_source_full_area || area + low_area_multiplier >= max_area;
      
      let needs_write_face = area > low_area_multiplier && ( num_clipped_edges > 0u || clipped_clip_counts[ 0u ] != 0i || clipped_clip_counts[ 1u ] != 0i || clipped_clip_counts[ 2u ] != 0i || clipped_clip_counts[ 3u ] != 0i );
      let needs_write_edges = needs_write_face && !is_full_area;
      
      let required_edge_count = select( 0u, num_clipped_edges, needs_write_edges );
      let required_face_count = select( 0u, 1u, needs_write_face );
      
      var offsets = vec2( required_edge_count, required_face_count );
      
      ${scanWGSL( {
        workgroupSize: 256,
        value: wgsl`offsets`,
        scratch: wgsl`scratch_data`,
        binaryOp: Vec2uAdd,
        exclusive: false,
        scratchPreloaded: false,
        valuePreloaded: true
      } )}
      
      if ( local_id.x == 0xffu ) {
        // inclusive scan, so we'll request the atomics here
        base_indices = vec2(
          // TODO: detect and record overflow
          atomicAdd( &addresses[ 1u ], offsets.x ),
          atomicAdd( &addresses[ 0u ], offsets.y )
        );
      }
      
      workgroupBarrier();
      
      // currently no uniform control flow required beyond here, we'll exit out early it if we don't need to write things
      
      // Need to subtract off required counts due to inclusive scan
      let edges_index = base_indices.x + offsets.x - required_edge_count;
      let face_index = base_indices.y + offsets.y - required_face_count;
      
      // We can now skip threads that don't need to write faces (unless we start with a coalesced edge read in the future)
      if ( !needs_write_face ) {
        return;
      }
      
      let bin_index = local_id.x + ( coarse_face.tile_index << 8u );
      
      // bump allocation
      // TODO: detect and record overflow
      let previous_address = atomicExchange( &addresses[ bin_index + 2u ], face_index );
      
      // TODO: see if moving this down further reduces latency?
      fine_renderable_faces[ face_index ] = ${TwoPassFineRenderableFaceWGSL}(
        coarse_face.bits | select( 0u, 0x80000000u, is_full_area ),
        edges_index,
        required_edge_count,
        pack4xI8( clipped_clip_counts ),
        previous_address
      );
      
      if ( !needs_write_edges ) {
        return;
      } 
      
      // write edges out
      var edge_index = edges_index;
      for ( var edge_offset = 0u; edge_offset < coarse_face.num_edges; edge_offset++ ) {
        // TODO: coalesced reads of this for the future, once we have correctness
        let linear_edge = coarse_edges[ coarse_face.edges_index + edge_offset ];
        
        let bounds_centroid = 0.5f * ( min + max );
        let result = ${bounds_clip_edgeWGSL( wgsl`linear_edge`, wgsl`min.x`, wgsl`min.y`, wgsl`max.x`, wgsl`max.y`, wgsl`bounds_centroid.x`, wgsl`bounds_centroid.y` )};
        
        for ( var i = 0u; i < result.count; i++ ) {
          let edge = result.edges[ i ];
        
          if ( !is_edge_clipped_count( edge.startPoint, edge.endPoint, min, max ) ) {
            fine_edges[ edge_index ] = edge;
            
            edge_index += 1u;
          }
        }
      }
    }
    
    fn is_edge_clipped_count( p0: vec2f, p1: vec2f, min: vec2f, max: vec2f ) -> bool {
      return all( ( p0 == min ) | ( p0 == max ) ) &&
             all( ( p1 == min ) | ( p1 == max ) ) &&
             ( p0.x == p1.x ) != ( p0.y == p1.y );
    }
  ` );
};