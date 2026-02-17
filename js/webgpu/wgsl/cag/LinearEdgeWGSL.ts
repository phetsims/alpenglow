// Copyright 2024-2025, University of Colorado Boulder

/**
 * WGSL form for a LinearEdge, with a start and end point.
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import { wgsl, WGSLReferenceModule } from '../WGSLString.js';

export const LinearEdgeWGSL = new WGSLReferenceModule( 'LinearEdge', wgsl`
  struct LinearEdge {
    startPoint: vec2f,
    endPoint: vec2f
  }
` );