// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

const lss_inv_gamma = 1.0 / 2.4;

fn linear_sRGB_to_sRGB( color: vec3f ) -> vec3f {
  // https://entropymine.com/imageworsener/srgbformula/ (a more precise formula for sRGB)
  // Linear to sRGB
  // 0 ≤ L ≤ 0.00313066844250063 : S = L×12.92
  // 0.00313066844250063 < L ≤ 1 : S = 1.055×L^1/2.4 − 0.055

  return select( 1.055 * pow( color, vec3( lss_inv_gamma ) ) - 0.055, color * 12.92, color <= vec3( 0.00313066844250063 ) );
}
