// Copyright 2024, University of Colorado Boulder

/**
 * Bounds-clips a specific edge, returning a certain number of edges that are within the bounds.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { wgsl, WGSLExpression, WGSLExpressionF32, WGSLReferenceModule, wgslString, WGSLStringModule } from '../WGSLString.js';
import { LinearEdgeWGSL } from '../cag/LinearEdgeWGSL.js';
import { matthes_drakopoulos_clipWGSL } from './matthes_drakopoulos_clipWGSL.js';

// TODO: for memory, we really should have this be array<vec2f,4>, since we're duplicating the start/end points
export const bounds_clip_edge_ResultWGSL = new WGSLReferenceModule( 'bounds_clip_edge_Result', wgsl`
  struct bounds_clip_edge_Result {
    edges: array<${LinearEdgeWGSL},3>,
    count: u32
  }
` );

export const bounds_clip_edgeWGSL = (
  edge: WGSLExpression, // LinearEdge
  minX: WGSLExpressionF32,
  minY: WGSLExpressionF32,
  maxX: WGSLExpressionF32,
  maxY: WGSLExpressionF32,
  centerX: WGSLExpressionF32,
  centerY: WGSLExpressionF32,
  useExactSlope = false
): WGSLExpression => {
  const name = `bounds_clip_edge${useExactSlope ? '_exact_slope' : ''}`;

  return new WGSLStringModule( name, wgsl`${wgslString( name )}( ${edge}, ${minX}, ${minY}, ${maxX}, ${maxY}, ${centerX}, ${centerY} )`, wgsl`
    fn bounds_clip_edge(
      edge: ${LinearEdgeWGSL},
      minX: f32,
      minY: f32,
      maxX: f32,
      maxY: f32,
      centerX: f32,
      centerY: f32
    ) -> ${bounds_clip_edge_ResultWGSL} {
      var edges: array<${LinearEdgeWGSL},3>;
      var count: u32 = 0u;
    
      // TODO: can we get rid of these if performance matters?
      let startPoint = edge.startPoint;
      let endPoint = edge.endPoint;
      let clipResult: MD_ClipResult = ${matthes_drakopoulos_clipWGSL(
        wgsl`startPoint`,
        wgsl`endPoint`,
        wgsl`minX`,
        wgsl`minY`,
        wgsl`maxX`,
        wgsl`maxY`
      )};
    
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
          edges[ count ] = ${LinearEdgeWGSL}( startCorner, clippedStartPoint );
          count++;
        }
    
        if ( !all( clippedStartPoint == clippedEndPoint ) ) {
          edges[ count ] = ${LinearEdgeWGSL}( clippedStartPoint, clippedEndPoint );
          count++;
        }
    
        if ( needsEndCorner && !all( endCorner == clippedEndPoint ) ) {
          edges[ count ] = ${LinearEdgeWGSL}( clippedEndPoint, endCorner );
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
    
          edges[ 0u ] = ${LinearEdgeWGSL}( startCorner, middlePoint );
          edges[ 1u ] = ${LinearEdgeWGSL}( middlePoint, endCorner );
          count = 2u;
        }
        else if ( !all( startCorner == endCorner ) ) {
          edges[ 0u ] = ${LinearEdgeWGSL}( startCorner, endCorner );
          count = 1u;
        }
      }
    
      return ${bounds_clip_edge_ResultWGSL}( edges, count );
    }
` );
};