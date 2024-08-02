// Copyright 2024, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { BufferBindingType, BufferSlot, LinearEdge, TwoPassCoarseRenderableFace, TwoPassCoarseRenderableFaceWGSL, TwoPassConfig, TwoPassFineRenderableFace, wgsl, WGSLMainModule, WGSLSlot } from '../../../imports.js';
import optionize from '../../../../../phet-core/js/optionize.js';

export type mainTwoPassCoarseWGSLOptions = {
  // input
  config: BufferSlot<TwoPassConfig>;
  coarseRenderableFaces: BufferSlot<TwoPassCoarseRenderableFace[]>;
  coarseEdges: BufferSlot<LinearEdge[]>;

  // output
  fineRenderableFaces: BufferSlot<TwoPassFineRenderableFace[]>;
  fineEdges: BufferSlot<LinearEdge[]>;
  addresses: BufferSlot<number[]>; // note: first atomic is face-allocation, second is edge-allocation
};

const mainTwoPassCoarseWGSL = (
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
    const oops_inifinite_loop_code = vec4f( 0.5f, 0.5f, 0f, 0.5f );
    
    const low_area_multiplier = 1e-4f;
    
    var<workgroup> coarse_face: ${TwoPassCoarseRenderableFaceWGSL};
    
    @compute @workgroup_size(256)
    fn main(
      @builtin(global_invocation_id) global_id: vec3u,
      @builtin(local_invocation_id) local_id: vec3u,
      @builtin(workgroup_id) workgroup_id: vec3u
    ) {
      if ( local_id.x == 0u ) {
        coarse_face = coarse_renderable_faces[ workgroup_id.x ];
      }
      
      workgroupBarrier();
      
      let relative_bin_xy = vec2( local_id.x % 16u, local_id.x / 16u );
    }
  ` );
};

export default mainTwoPassCoarseWGSL;