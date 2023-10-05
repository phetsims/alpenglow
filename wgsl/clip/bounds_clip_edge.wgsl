// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

#import ../cag/LinearEdge
#import ./matthes_drakopoulos_clip

struct bounds_clip_edge_Result {
  // TODO: for memory, we really should have this be array<vec2f,4>, since we're duplicating the start/end points
  edges: array<LinearEdge,3>,
  count: u32
}

fn bounds_clip_edge(
  edge: LinearEdge,
  minX: f32,
  minY: f32,
  maxX: f32,
  maxY: f32,
  centerX: f32,
  centerY: f32
) -> bounds_clip_edge_Result {
  var edges: array<LinearEdge,3>;
  var count: u32 = 0u;

  // TODO: can we get rid of these if performance matters?
  let startPoint = edge.startPoint;
  let endPoint = edge.endPoint;
  let clipResult: MD_ClipResult = matthes_drakopoulos_clip( startPoint, endPoint, minX, minY, maxX, maxY );

  let clippedStartPoint = clipResult.p0;
  let clippedEndPoint = clipResult.p1;
  let clipped = clipResult.clipped;

  let startXLess = startPoint.x < centerX;
  let startYLess = startPoint.y < centerY;
  let endXLess = endPoint.x < centerX;
  let endYLess = endPoint.y < centerY;

  let needsStartCorner = !clipped || !all( startPoint == clippedStartPoint );
  let needsEndCorner = !clipped || !all( endPoint == clippedEndPoint );

  // TODO: see if select is slower than if/else?

  // TODO: see if we can check for needsStartCorner/needsEndCorner before computing these?
  let startCorner = vec2(
    select( maxX, minX, startXLess ),
    select( maxY, minY, startYLess )
  );
  let endCorner = vec2(
    select( maxX, minX, endXLess ),
    select( maxY, minY, endYLess )
  );

  if ( clipped ) {
    if ( needsStartCorner && !all( startCorner == clippedStartPoint ) ) {
      edges[ count ] = LinearEdge( startCorner, clippedStartPoint );
      count++;
    }

    if ( !all( clippedStartPoint == clippedEndPoint ) ) {
      edges[ count ] = LinearEdge( clippedStartPoint, clippedEndPoint );
      count++;
    }

    if ( needsEndCorner && !all( endCorner == clippedEndPoint ) ) {
      edges[ count ] = LinearEdge( clippedEndPoint, endCorner );
      count++;
    }
  }
  else {
    if ( startXLess != endXLess && startYLess != endYLess ) {
      // we crossed from one corner to the opposite, but didn't hit. figure out which corner we passed
      // we're diagonal, so solving for y=centerY should give us the info we need
      let y = startPoint.y + ( endPoint.y - startPoint.y ) * ( centerX - startPoint.x ) / ( endPoint.x - startPoint.x );

      // Based on whether we are +x+y => -x-y or -x+y => +x-y
      let startSame = startXLess == startYLess;
      let yGreater = y > centerY;

      let middlePoint = vec2(
        select( maxX, minX, startSame == yGreater ),
        select( minY, maxY, yGreater )
      );

      edges[ 0u ] = LinearEdge( startCorner, middlePoint );
      edges[ 1u ] = LinearEdge( middlePoint, endCorner );
      count = 2u;
    }
    else if ( !all( startCorner == endCorner ) ) {
      edges[ 0u ] = LinearEdge( startCorner, endCorner );
      count = 1u;
    }
  }

  return bounds_clip_edge_Result( edges, count );
}
