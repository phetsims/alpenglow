// Copyright 2023, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

fn linear_displayP3_to_linear_sRGB( color: vec3f ) -> vec3f {
  // Formulas from computations in RenderColor
  return vec3(
    1.2249297438736997 * color.r + -0.2249297438736996 * color.g,
    -0.04205861411592876 * color.r + 1.0420586141159287 * color.g,
    -0.019641278613420788 * color.r + -0.07864798001761002 * color.g + 1.0982892586310309 * color.b
  );
}
