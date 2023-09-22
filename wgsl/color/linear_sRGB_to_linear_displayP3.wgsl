// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

fn linear_sRGB_to_linear_displayP3( color: vec3f ) -> vec3f {
  // Formulas from computations in RenderColor
  return vec3(
    0.8224689734082459 * color.r + 0.17753102659175413 * color.g,
    0.03319573842230447 * color.r + 0.9668042615776956 * color.g,
    0.017085772151775966 * color.r + 0.07240728066524241 * color.g + 0.9105069471829815 * color.b
  );
}
