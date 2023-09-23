// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ../LinearEdge

fn shoelace( edge: LinearEdge ) -> f32 {
  return 0.5 * ( edge.endPoint.x + edge.startPoint.x ) * ( edge.endPoint.y - edge.startPoint.y );
}
