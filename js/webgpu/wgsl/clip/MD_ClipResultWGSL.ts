// Copyright 2024, University of Colorado Boulder

import { wgsl, WGSLReferenceModule } from '../../../imports.js';

/**
 * Struct for the result of Matthes-Drakopoulos clipping, see matthes_drakopoulos_clipWGSL.ts.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

export default new WGSLReferenceModule( 'MD_ClipResult', wgsl`
  struct MD_ClipResult {
    p0: vec2f,
    p1: vec2f,
    clipped: bool
  }
` );