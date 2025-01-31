// Copyright 2024-2025, University of Colorado Boulder

/**
 * Struct for rational intersection points.
 *
 * t0: The parametric t value for the first curve
 * t1: The parametric t value for the second curve
 * px: The x-coordinate of the intersection point
 * py: The y-coordinate of the intersection point
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { wgsl, WGSLReferenceModule } from '../WGSLString.js';
import { q128WGSL } from './q128WGSL.js';

export const IntersectionPointWGSL = new WGSLReferenceModule( 'IntersectionPoint', wgsl`
  struct IntersectionPoint {
    t0: ${q128WGSL},
    t1: ${q128WGSL},
    px: ${q128WGSL},
    py: ${q128WGSL}
  }
` );