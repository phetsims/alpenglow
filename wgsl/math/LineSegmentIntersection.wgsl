// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ./IntersectionPoint

struct LineSegmentIntersection {
  num_points: u32, // can include overlap points
  p0: IntersectionPoint,
  p1: IntersectionPoint
}
