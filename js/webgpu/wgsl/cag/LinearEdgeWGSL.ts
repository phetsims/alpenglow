// Copyright 2024, University of Colorado Boulder

import { wgsl, WGSLReferenceModule } from '../../../imports.js';

/**
 * WGSL form for a LinearEdge, with a start and end point.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

export default new WGSLReferenceModule( 'LinearEdge', wgsl`
  struct LinearEdge {
    startPoint: vec2f,
    endPoint: vec2f
  }
` );