// Copyright 2024, University of Colorado Boulder

/**
 * Converts a linear sRGB color to the oklab color space.
 *
 * See RenderColor.linearToOklab for more information.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { wgsl, WGSLExpression, WGSLStringModule } from '../WGSLString.js';
import { cbrtWGSL } from '../math/cbrtWGSL.js';

export const linear_sRGB_to_oklabWGSL = (
  vec3: WGSLExpression
): WGSLExpression => {
  return new WGSLStringModule( 'linear_sRGB_to_oklab', wgsl`linear_sRGB_to_oklab( ${vec3} )`, wgsl`
  fn linear_sRGB_to_oklab( color: vec3f ) -> vec3f {
    let l = 0.4122214708 * color.r + 0.5363325363 * color.g + 0.0514459929 * color.b;
    let m = 0.2119034982 * color.r + 0.6806995451 * color.g + 0.1073969566 * color.b;
    let s = 0.0883024619 * color.r + 0.2817188376 * color.g + 0.6299787005 * color.b;
  
    let l_ = ${cbrtWGSL( wgsl`l` )};
    let m_ = ${cbrtWGSL( wgsl`m` )};
    let s_ = ${cbrtWGSL( wgsl`s` )};
  
    return vec3(
      0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
      1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
      0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
    );
  }
` );
};