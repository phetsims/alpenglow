// Copyright 2024-2025, University of Colorado Boulder

/**
 * Implementation of RenderBlendCompose.blendCompose in WGSL.
 *
 * A good chunk of the code here is borrowed from Vello (https://github.com/linebender/vello), so the license for that
 * is produced below.
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import { u32S, wgsl, WGSLExpression, WGSLExpressionBool, WGSLExpressionU32, WGSLStringModule } from '../WGSLString.js';
import { unpremultiplyWGSL } from './unpremultiplyWGSL.js';
import { premultiplyWGSL } from './premultiplyWGSL.js';
import { RenderBlendType } from '../../../render-program/RenderBlendType.js';
import { RenderComposeType } from '../../../render-program/RenderComposeType.js';

/*
Copyright (c) 2020 Raph Levien

Permission is hereby granted, free of charge, to any
person obtaining a copy of this software and associated
documentation files (the "Software"), to deal in the
Software without restriction, including without
limitation the rights to use, copy, modify, merge,
publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software
is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice
shall be included in all copies or substantial portions
of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF
ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED
TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT
SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR
IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
DEALINGS IN THE SOFTWARE.
*/

export const blend_composeWGSL = (
  a: WGSLExpression, // vec4f - foreground
  b: WGSLExpression, // vec4f - background
  composeType: WGSLExpressionU32, // u32
  blendType: WGSLExpressionU32 // u32
): WGSLExpressionBool => {
  return new WGSLStringModule( 'blend_compose', wgsl`blend_compose( ${a}, ${b}, ${composeType}, ${blendType} )`, wgsl`
    fn screen(cb: vec3f, cs: vec3f) -> vec3f {
      return cb + cs - (cb * cs);
    }
    
    fn color_dodge(cb: f32, cs: f32) -> f32 {
      if cb == 0.0 {
        return 0.0;
      } else if cs == 1.0 {
        return 1.0;
      } else {
        return min(1.0, cb / (1.0 - cs));
      }
    }
    
    fn color_burn(cb: f32, cs: f32) -> f32 {
      if cb == 1.0 {
        return 1.0;
      } else if cs == 0.0 {
        return 0.0;
      } else {
        return 1.0 - min(1.0, (1.0 - cb) / cs);
      }
    }
    
    fn hard_light(cb: vec3f, cs: vec3f) -> vec3f {
      return select(
        screen(cb, 2.0 * cs - 1.0),
        cb * 2.0 * cs,
        cs <= vec3(0.5)
      );
    }
    
    fn soft_light(cb: vec3f, cs: vec3f) -> vec3f {
      let d = select(
        sqrt(cb),
        ((16.0 * cb - 12.0) * cb + 4.0) * cb,
        cb <= vec3(0.25)
      );
      return select(
        cb + (2.0 * cs - 1.0) * (d - cb),
        cb - (1.0 - 2.0 * cs) * cb * (1.0 - cb),
        cs <= vec3(0.5)
      );
    }
    
    fn sat(c: vec3f) -> f32 {
      return max(c.x, max(c.y, c.z)) - min(c.x, min(c.y, c.z));
    }
    
    fn lum(c: vec3f) -> f32 {
      let f = vec3(0.3, 0.59, 0.11);
      return dot(c, f);
    }
    
    fn clip_color(c_in: vec3f) -> vec3f {
      var c = c_in;
      let l = lum(c);
      let n = min(c.x, min(c.y, c.z));
      let x = max(c.x, max(c.y, c.z));
      if n < 0.0 {
        c = l + (((c - l) * l) / (l - n));
      }
      if x > 1.0 {
        c = l + (((c - l) * (1.0 - l)) / (x - l));
      }
      return c;
    }
    
    fn set_lum(c: vec3f, l: f32) -> vec3f {
      return clip_color(c + (l - lum(c)));
    }
    
    fn set_sat_inner(
      cmin: ptr<function, f32>,
      cmid: ptr<function, f32>,
      cmax: ptr<function, f32>,
      s: f32
    ) {
      if *cmax > *cmin {
        *cmid = ((*cmid - *cmin) * s) / (*cmax - *cmin);
        *cmax = s;
      } else {
        *cmid = 0.0;
        *cmax = 0.0;
      }
      *cmin = 0.0;
    }
    
    fn set_sat(c: vec3f, s: f32) -> vec3f {
      var r = c.r;
      var g = c.g;
      var b = c.b;
      if r <= g {
        if g <= b {
          set_sat_inner(&r, &g, &b, s);
        } else {
          if r <= b {
            set_sat_inner(&r, &b, &g, s);
          } else {
            set_sat_inner(&b, &r, &g, s);
          }
        }
      } else {
        if r <= b {
          set_sat_inner(&g, &r, &b, s);
        } else {
          if g <= b {
            set_sat_inner(&g, &b, &r, s);
          } else {
            set_sat_inner(&b, &g, &r, s);
          }
        }
      }
      return vec3(r, g, b);
    }
    
    // a: foreground
    // b: background
    fn blend_compose( a: vec4f, b: vec4f, composeType: u32, blendType: u32 ) -> vec4f {
      var blended: vec4f;
      if ( blendType == ${u32S( RenderBlendType.Normal )} ) {
        blended = a;
      }
      else {
        // Need to apply blending when not premultiplied
        let a3 = ${unpremultiplyWGSL( wgsl`a` )}.rgb;
        let b3 = ${unpremultiplyWGSL( wgsl`b` )}.rgb;
        var c3: vec3f;
    
        switch ( blendType ) {
          case ${u32S( RenderBlendType.Multiply )}: {
            c3 = b3 * a3;
          }
          case ${u32S( RenderBlendType.Screen )}: {
            c3 = screen( b3, a3 );
          }
          case ${u32S( RenderBlendType.Overlay )}: {
            c3 = hard_light( a3, b3 );
          }
          case ${u32S( RenderBlendType.Darken )}: {
            c3 = min( b3, a3 );
          }
          case ${u32S( RenderBlendType.Lighten )}: {
            c3 = max( b3, a3 );
          }
          case ${u32S( RenderBlendType.ColorDodge )}: {
            c3 = vec3(
              color_dodge( b3.x, a3.x ),
              color_dodge( b3.y, a3.y ),
              color_dodge( b3.z, a3.z )
            );
          }
          case ${u32S( RenderBlendType.ColorBurn )}: {
            c3 = vec3(
              color_burn( b3.x, a3.x ),
              color_burn( b3.y, a3.y ),
              color_burn( b3.z, a3.z )
            );
          }
          case ${u32S( RenderBlendType.HardLight )}: {
            c3 = hard_light( b3, a3 );
          }
          case ${u32S( RenderBlendType.SoftLight )}: {
            c3 = soft_light( b3, a3 );
          }
          case ${u32S( RenderBlendType.Difference )}: {
            c3 = abs( b3 - a3 );
          }
          case ${u32S( RenderBlendType.Exclusion )}: {
            c3 = b3 + a3 - 2f * b3 * a3;
          }
          case ${u32S( RenderBlendType.Hue )}: {
            c3 = set_lum( set_sat( a3, sat( b3 ) ), lum( b3 ) );
          }
          case ${u32S( RenderBlendType.Saturation )}: {
            c3 = set_lum( set_sat( b3, sat( a3 ) ), lum( b3 ) );
          }
          case ${u32S( RenderBlendType.Color )}: {
            c3 = set_lum( a3, lum( b3 ) );
          }
          case ${u32S( RenderBlendType.Luminosity )}: {
            c3 = set_lum( b3, lum( a3 ) );
          }
          default: {
            c3 = a3;
          }
        }
    
        blended = ${premultiplyWGSL( wgsl`vec4( c3, a.a )` )};
      }
    
      var fa: f32;
      var fb: f32;
    
      // over: fa: 1,   fb: 1-a   fa*a: a      fb*b: b(1-a) sum: a + b(1-a)
      // in:   fa: b,   fb: 0     fa*a: ab     fb*b: 0      sum: ab
      // out:  fa: 1-b, fb: 0     fa*a: a(1-b) fb*b: 0      sum: a(1-b)
      // atop: fa: b,   fb: 1-a   fa*a: ab     fb*b: b(1-a) sum: b
      // xor:  fa: 1-b, fb: 1-a   fa*a: a(1-b) fb*b: b(1-a) sum: a(1-b) + b(1-a)
      // plus: fa: 1,   fb: 1     fa*a: a      fb*b: b      sum: a + b
      switch( composeType ) {
        case ${u32S( RenderComposeType.Over )}: {
          fa = 1f;
          fb = 1f - a.a;
        }
        case ${u32S( RenderComposeType.In )}: {
          fa = b.a;
          fb = 0f;
        }
        case ${u32S( RenderComposeType.Out )}: {
          fa = 1f - b.a;
          fb = 0f;
        }
        case ${u32S( RenderComposeType.Atop )}: {
          fa = b.a;
          fb = 1f - a.a;
        }
        case ${u32S( RenderComposeType.Xor )}: {
          fa = 1f - b.a;
          fb = 1f - a.a;
        }
        case ${u32S( RenderComposeType.Plus )}: {
          fa = 1f;
          fb = 1f;
        }
        case ${u32S( RenderComposeType.PlusLighter )}: {
          // TODO: is this correct? seems to differ from Vello
          return min( vec4( 1f ), vec4( a + b ) );
        }
        default: {}
      }
    
      // NO clamping, because of color spaces and filters with negative lobes
      return vec4( fa * blended.rgb + fb * b.rgb, fa * a.a + fb * b.a );
    }
` );
};