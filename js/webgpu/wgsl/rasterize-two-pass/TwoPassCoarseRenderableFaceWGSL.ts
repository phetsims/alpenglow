// Copyright 2024-2025, University of Colorado Boulder

import { wgsl, WGSLReferenceModule } from '../WGSLString.js';

/**
 * Uniforms for a TwoPassCoarseRenderableFace
 *
 * bits
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
 * tileIndex
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

export const TwoPassCoarseRenderableFaceWGSL = new WGSLReferenceModule( 'TwoPassCoarseRenderableFace', wgsl`
  struct TwoPassCoarseRenderableFace {
    bits: u32,
    edges_index: u32,
    num_edges: u32,
    clip_counts: u32,
    tile_index: u32
  }
` );