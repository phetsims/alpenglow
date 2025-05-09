// Copyright 2024-2025, University of Colorado Boulder

/**
 * Uniforms for a TwoPassInitialRenderableFace
 *
 * bits
 *   0x00ffffff: renderProgramIndex
 *   0x10000000: needsCentroid
 *   0x20000000: needsFace
 *   0x40000000: isConstant
 *   0x80000000: isFullArea
 * edgesIndex
 * numEdges
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { wgsl, WGSLReferenceModule } from '../WGSLString.js';

export const TwoPassInitialRenderableFaceWGSL = new WGSLReferenceModule( 'TwoPassInitialRenderableFace', wgsl`
  struct TwoPassInitialRenderableFace {
    bits: u32,
    edges_index: u32,
    num_edges: u32
  }
` );