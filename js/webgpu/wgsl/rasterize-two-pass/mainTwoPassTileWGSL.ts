// Copyright 2024, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { bounds_clip_edgeWGSL, BufferBindingType, BufferSlot, LinearEdge, scanWGSL, TwoPassCoarseRenderableFace, TwoPassCoarseRenderableFaceWGSL, TwoPassConfig, TwoPassInitialRenderableFace, Vec2uAdd, wgsl, WGSLExpressionU32, WGSLMainModule, WGSLSlot } from '../../../imports.js';
import optionize from '../../../../../phet-core/js/optionize.js';

export type mainTwoPassTileWGSLOptions = {
  // input
  config: BufferSlot<TwoPassConfig>;
  initialRenderableFaces: BufferSlot<TwoPassInitialRenderableFace[]>;
  initialEdges: BufferSlot<LinearEdge[]>;

  // output
  coarseRenderableFaces: BufferSlot<TwoPassCoarseRenderableFace[]>;
  coarseEdges: BufferSlot<LinearEdge[]>;
  addresses: BufferSlot<number[]>; // note: first atomic is face-allocation, second is edge-allocation

  numInitialRenderableFaces: WGSLExpressionU32;
};

export const MAIN_TWO_PASS_TILE_DEFAULTS = {
  // placeholder
} as const;

const mainTwoPassTileWGSL = (
  providedOptions: mainTwoPassTileWGSLOptions
): WGSLMainModule => {

  const options = optionize<mainTwoPassTileWGSLOptions>()( {

  }, providedOptions );

  const configSlot = new WGSLSlot( 'config', options.config, BufferBindingType.UNIFORM );
  const initialRenderableFacesSlot = new WGSLSlot( 'initial_renderable_faces', options.initialRenderableFaces, BufferBindingType.READ_ONLY_STORAGE );
  const initialEdgesSlot = new WGSLSlot( 'initial_edges', options.initialEdges, BufferBindingType.READ_ONLY_STORAGE );

  const coarseRenderableFacesSlot = new WGSLSlot( 'coarse_renderable_faces', options.coarseRenderableFaces, BufferBindingType.STORAGE );
  const coarseEdgesSlot = new WGSLSlot( 'coarse_edges', options.coarseEdges, BufferBindingType.STORAGE );
  const addressesSlot = new WGSLSlot( 'addresses', options.addresses, BufferBindingType.STORAGE );

  return new WGSLMainModule( [
    configSlot,
    initialRenderableFacesSlot,
    initialEdgesSlot,
    coarseRenderableFacesSlot,
    coarseEdgesSlot,
    addressesSlot
  ], wgsl`
    const low_area_multiplier = 1e-4f;
    
    var<workgroup> scratch_data: array<vec2u, 256>;
    var<workgroup> base_indices: vec2u;
    
    @compute @workgroup_size(256)
    fn main(
      @builtin(global_invocation_id) global_id: vec3u,
      @builtin(local_invocation_id) local_id: vec3u,
      @builtin(workgroup_id) workgroup_id: vec3u
    ) {
      let num_tiles = config.tile_width * config.tile_height;
      let source_face_index = global_id.x / num_tiles;
      let tile_index = global_id.x % num_tiles;
      
      let skip_tile = source_face_index >= ${options.numInitialRenderableFaces};
      
      let initial_face = initial_renderable_faces[ select( 0u, source_face_index, !skip_tile ) ];
    
      let tile_index_xy = vec2(
        tile_index % config.tile_width,
        tile_index / config.tile_width
      );
      
      let filter_expansion = select( select( 2f, 1f, config.filter_type == 1u ), 0.5f, config.filter_type == 0u ) * config.filter_scale - 0.5f;
      
      let min = vec2f( tile_index_xy * vec2( config.tile_size ) ) - vec2( filter_expansion );
      let max = vec2f( ( tile_index_xy + vec2( 1u ) ) * vec2( config.tile_size ) ) + vec2( filter_expansion );
      
      var area: f32;
      var num_clipped_edges: u32 = 0u;
      var clipped_clip_counts = vec4i( 0i );
      
      let max_area = ( max.x - min.x ) * ( max.y - min.y );
      
      let is_source_full_area = ( initial_face.bits & 0x80000000u ) != 0u;
      
      if ( is_source_full_area ) {
        area = max_area;
      }
      else if ( !skip_tile ) { // do NOT need uniform control flow inside here
        area = 0f;
      
        // Accumulate to area partial
        for ( var edge_offset = 0u; edge_offset < initial_face.num_edges; edge_offset++ ) {
          // TODO: coalesced reads of this for the future, once we have correctness
          let linear_edge = initial_edges[ initial_face.edges_index + edge_offset ];
          
          let bounds_centroid = 0.5f * ( min + max );
          let result = ${bounds_clip_edgeWGSL( wgsl`linear_edge`, wgsl`min.x`, wgsl`min.y`, wgsl`max.x`, wgsl`max.y`, wgsl`bounds_centroid.x`, wgsl`bounds_centroid.y` )};
          
          for ( var i = 0u; i < result.count; i++ ) {
            let edge = result.edges[ i ];
          
            let p0 = edge.startPoint;
            let p1 = edge.endPoint;
            
            area += ( p1.x + p0.x ) * ( p1.y - p0.y );
            
            if ( is_edge_clipped_count( p0, p1, min, max ) ) {
              // TODO: consider NOT writing the clip counts in this (hopefully faster) loop?
              
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
      
      let needs_write_face = !skip_tile && area > low_area_multiplier;
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
      
      // TODO: see if moving this down further reduces latency?
      coarse_renderable_faces[ face_index ] = ${TwoPassCoarseRenderableFaceWGSL}(
        initial_face.bits | select( 0u, 0x80000000u, is_full_area ),
        edges_index,
        required_edge_count,
        pack4xI8( clipped_clip_counts ),
        tile_index
      );
      
      if ( !needs_write_edges ) {
        return;
      } 
      
      // write edges out
      var edge_index = edges_index;
      for ( var edge_offset = 0u; edge_offset < initial_face.num_edges; edge_offset++ ) {
        // TODO: coalesced reads of this for the future, once we have correctness
        let linear_edge = initial_edges[ initial_face.edges_index + edge_offset ];
        
        let bounds_centroid = 0.5f * ( min + max );
        let result = ${bounds_clip_edgeWGSL( wgsl`linear_edge`, wgsl`min.x`, wgsl`min.y`, wgsl`max.x`, wgsl`max.y`, wgsl`bounds_centroid.x`, wgsl`bounds_centroid.y` )};
        
        for ( var i = 0u; i < result.count; i++ ) {
          let edge = result.edges[ i ];
        
          if ( !is_edge_clipped_count( edge.startPoint, edge.endPoint, min, max ) ) {
            coarse_edges[ edge_index ] = edge;
            
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

export default mainTwoPassTileWGSL;