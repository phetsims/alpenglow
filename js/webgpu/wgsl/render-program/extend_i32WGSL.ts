// Copyright 2024, University of Colorado Boulder

import { RenderExtend, u32S, wgsl, WGSLExpression, WGSLExpressionI32, WGSLExpressionU32, WGSLStringModule } from '../../../imports.js';

/**
 * Integer extension for RenderExtend.
 *
 * Given size=4, provide the following patterns:
 *
 * input:  -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9
 *
 * pad:     0,  0,  0,  0,  0,  0, 0, 1, 2, 3, 3, 3, 3, 3, 3, 3
 * repeat:  2,  3,  0,  1,  2,  3, 0, 1, 2, 3, 0, 1, 2, 3, 0, 1
 * reflect: 2,  3,  3,  2,  1,  0, 0, 1, 2, 3, 3, 2, 1, 0, 0, 1
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

export default (
  i: WGSLExpressionI32,
  size: WGSLExpressionI32,
  extend: WGSLExpressionU32
): WGSLExpression => {
  return new WGSLStringModule( 'extend_i32', wgsl`extend_i32( ${i}, ${size}, ${extend} )`, wgsl`
    fn extend_i32( i: i32, size: i32, extend: u32 ) -> i32 {
      switch ( extend ) {
        case ${u32S( RenderExtend.Pad )}: {
          return clamp( i, 0i, size - 1i );
        }
        case ${u32S( RenderExtend.Repeat )}: {
          if ( i >= 0i ) {
            return i % size;
          }
          else {
            return size - ( ( -i - 1i ) % size ) - 1i;
          }
        }
        case ${u32S( RenderExtend.Reflect )}: {
          // easier to convert both to positive (with a repeat offset)
          let pos_i = select( i, -i - 1i, i < 0i );
    
          let section = pos_i % ( size * 2i );
          if ( section < size ) {
            return section;
          }
          else {
            return 2i * size - section - 1i;
          }
        }
        default: {
          return i;
        }
      }
    }
` );
};