// Copyright 2024-2025, University of Colorado Boulder

/**
 * Struct for an intersection between two line segments. Two points needed, in case of partial overlap.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { wgsl, WGSLReferenceModule } from '../WGSLString.js';
import { IntersectionPointWGSL } from './IntersectionPointWGSL.js';

export const LineSegmentIntersectionWGSL = new WGSLReferenceModule( 'LineSegmentIntersection', wgsl`
  struct LineSegmentIntersection {
    num_points: u32, // can include overlap points
    p0: ${IntersectionPointWGSL},
    p1: ${IntersectionPointWGSL}
  }
` );