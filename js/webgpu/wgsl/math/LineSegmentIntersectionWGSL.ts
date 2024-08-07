// Copyright 2024, University of Colorado Boulder

import { IntersectionPointWGSL, wgsl, WGSLReferenceModule } from '../../../imports.js';

/**
 * Struct for an intersection between two line segments. Two points needed, in case of partial overlap.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

export default new WGSLReferenceModule( 'LineSegmentIntersection', wgsl`
  struct LineSegmentIntersection {
    num_points: u32, // can include overlap points
    p0: ${IntersectionPointWGSL},
    p1: ${IntersectionPointWGSL}
  }
` );