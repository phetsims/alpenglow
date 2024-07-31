// Copyright 2024, University of Colorado Boulder

import { wgsl, WGSLReferenceModule } from '../../../imports.js';

/**
 * Uniforms for a TwoPassFineRenderableFace
 *
 * bits:
 *   0x00ffffff: renderProgramIndex
 *   0x10000000: needsCentroid
 *   0x20000000: needsFace
 *   0x40000000: isConstant
 *   0x80000000: isFullArea
 * edgesIndex
 * numEdges
 * clip_counts (packed i8s):
 *   0x000000ff: minXCount
 *   0x0000ff00: minYCount
 *   0x00ff0000: maxXCount
 *   0xff000000: maxYCount
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

export default new WGSLReferenceModule( 'TwoPassConfig', wgsl`
  struct TwoPassConfig {
    bits: u32,
    edges_index: u32,
    num_edges: u32,
    clip_counts: u32,
    next_address: u32
  }
` );