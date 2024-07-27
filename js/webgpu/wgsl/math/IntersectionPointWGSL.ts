// Copyright 2024, University of Colorado Boulder

import { q128WGSL, wgsl, WGSLReferenceModule } from '../../../imports.js';

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

export default new WGSLReferenceModule( 'IntersectionPoint', wgsl`
  struct IntersectionPoint {
    t0: ${q128WGSL},
    t1: ${q128WGSL},
    px: ${q128WGSL},
    py: ${q128WGSL}
  }
` );