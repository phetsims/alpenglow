// Copyright 2024, University of Colorado Boulder

import { RenderExtend, u32S, wgsl, WGSLExpression, WGSLExpressionF32, WGSLExpressionU32, WGSLStringModule } from '../../../imports.js';

/**
 * Floating-point extension for RenderExtend.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

export default (
  t: WGSLExpressionF32,
  extend: WGSLExpressionU32
): WGSLExpression => {
  return new WGSLStringModule( 'extend_f32', wgsl`extend_f32( ${t}, ${extend} )`, wgsl`
    fn extend_f32( t: f32, extend: u32 ) -> f32 {
      switch ( extend ) {
        case ${u32S( RenderExtend.Pad )}: {
          return clamp( t, 0f, 1f );
        }
        case ${u32S( RenderExtend.Repeat )}: {
          return fract( t );
        }
        case ${u32S( RenderExtend.Reflect )}: {
          return abs( t - 2f * round( 0.5f * t ) );
        }
        default: {
          return t;
        }
      }
    }
` );
};