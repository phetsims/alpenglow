// Copyright 2024, University of Colorado Boulder

import { wgsl, WGSLExpression, WGSLExpressionF32, WGSLReferenceModule, wgslString, WGSLStringModule } from '../../../imports.js';

/**
 * From "Another Simple but Faster Method for 2D Line Clipping" (2019)
 * by Dimitrios Matthes and Vasileios Drakopoulos
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

export const MD_ClipResultWGSL = new WGSLReferenceModule( 'MD_ClipResult', wgsl`
  struct MD_ClipResult {
    p0: vec2f,
    p1: vec2f,
    clipped: bool
  }
` );

export default (
  p0: WGSLExpression, // vec2f
  p1: WGSLExpression, // vec2f
  minX: WGSLExpressionF32,
  minY: WGSLExpressionF32,
  maxX: WGSLExpressionF32,
  maxY: WGSLExpressionF32,
  useExactSlope = false
): WGSLExpression => {
  const name = `matthes_drakopoulos_clip${useExactSlope ? '_exact_slope' : ''}`;

  return new WGSLStringModule( name, wgsl`${wgslString( name )}( ${p0}, ${p1}, ${minX}, ${minY}, ${maxX}, ${maxY} )`, wgsl`
    fn ${wgslString( name )}(
      p0: vec2f,
      p1: vec2f,
      minX: f32,
      minY: f32,
      maxX: f32,
      maxY: f32
    ) -> ${MD_ClipResultWGSL} {
      if (
        !( p0.x < minX && p1.x < minX ) &&
        !( p0.x > maxX && p1.x > maxX ) &&
        !( p0.y < minY && p1.y < minY ) &&
        !( p0.y > maxY && p1.y > maxY )
      ) {
        var x0 = p0.x;
        var y0 = p0.y;
        var x1 = p1.x;
        var y1 = p1.y;
        
        ${useExactSlope ? wgsl`
            let ma = ( p1.y - p0.y ) / ( p1.x - p0.x );
            let mb = ( p1.x - p0.x ) / ( p1.y - p0.y );
        
            // Unrolled (duplicated essentially)
            if ( x0 < minX ) {
              x0 = minX;
              y0 = ma * ( minX - p0.x ) + p0.y;
            }
            else if ( x0 > maxX ) {
              x0 = maxX;
              y0 = ma * ( maxX - p0.x ) + p0.y;
            }
            if ( y0 < minY ) {
              y0 = minY;
              x0 = mb * ( minY - p0.y ) + p0.x;
            }
            else if ( y0 > maxY ) {
              y0 = maxY;
              x0 = mb * ( maxY - p0.y ) + p0.x;
            }
        
            // Second unrolled form
            if ( x1 < minX ) {
              x1 = minX;
              y1 = ma * ( minX - p0.x ) + p0.y;
            }
            else if ( x1 > maxX ) {
              x1 = maxX;
              y1 = ma * ( maxX - p0.x ) + p0.y;
            }
            if ( y1 < minY ) {
              y1 = minY;
              x1 = mb * ( minY - p0.y ) + p0.x;
            }
            else if ( y1 > maxY ) {
              y1 = maxY;
              x1 = mb * ( maxY - p0.y ) + p0.x;
            }
        ` : wgsl`
          // Unrolled (duplicated essentially)
          if ( x0 < minX ) {
            x0 = minX;
            y0 = ( p1.y - p0.y ) * ( minX - p0.x ) / ( p1.x - p0.x ) + p0.y;
          }
          else if ( x0 > maxX ) {
            x0 = maxX;
            y0 = ( p1.y - p0.y ) * ( maxX - p0.x ) / ( p1.x - p0.x ) + p0.y;
          }
          if ( y0 < minY ) {
            y0 = minY;
            x0 = ( p1.x - p0.x ) * ( minY - p0.y ) / ( p1.y - p0.y ) + p0.x;
          }
          else if ( y0 > maxY ) {
            y0 = maxY;
            x0 = ( p1.x - p0.x ) * ( maxY - p0.y ) / ( p1.y - p0.y ) + p0.x;
          }
      
          // Second unrolled form
          if ( x1 < minX ) {
            x1 = minX;
            y1 = ( p1.y - p0.y ) * ( minX - p0.x ) / ( p1.x - p0.x ) + p0.y;
          }
          else if ( x1 > maxX ) {
            x1 = maxX;
            y1 = ( p1.y - p0.y ) * ( maxX - p0.x ) / ( p1.x - p0.x ) + p0.y;
          }
          if ( y1 < minY ) {
            y1 = minY;
            x1 = ( p1.x - p0.x ) * ( minY - p0.y ) / ( p1.y - p0.y ) + p0.x;
          }
          else if ( y1 > maxY ) {
            y1 = maxY;
            x1 = ( p1.x - p0.x ) * ( maxY - p0.y ) / ( p1.y - p0.y ) + p0.x;
          }
        `}
    
        if ( !( x0 < minX && x1 < minX ) && !( x0 > maxX && x1 > maxX ) ) {
          return ${MD_ClipResultWGSL}( vec2( x0, y0 ), vec2( x1, y1 ), true );
        }
      }
    
      return ${MD_ClipResultWGSL}( p0, p1, false );
    }
` );
};