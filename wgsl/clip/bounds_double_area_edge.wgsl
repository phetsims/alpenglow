// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ../cag/LinearEdge
#import ./bounds_clip_edge

fn bounds_double_area_edge(
  edge: LinearEdge,
  minX: f32,
  minY: f32,
  maxX: f32,
  maxY: f32,
  centerX: f32,
  centerY: f32
) -> f32 {
  let clip = bounds_clip_edge( edge, minX, minY, maxX, maxY, centerX, centerY );
  var area = 0f;

  // Unrolled loop (should we go back to a for loop?)
  if ( clip.count > 0u ) {
    let edge0 = clip.edges[ 0u ];
    area += ( edge0.endPoint.x + edge0.startPoint.x ) * ( edge0.endPoint.y - edge0.startPoint.y );

    if ( clip.count > 1u ) {
      let edge1 = clip.edges[ 1u ];
      area += ( edge1.endPoint.x + edge1.startPoint.x ) * ( edge1.endPoint.y - edge1.startPoint.y );

      if ( clip.count > 2u ) {
        let edge2 = clip.edges[ 2u ];
        area += ( edge2.endPoint.x + edge2.startPoint.x ) * ( edge2.endPoint.y - edge2.startPoint.y );
      }
    }
  }

  return area;
}
