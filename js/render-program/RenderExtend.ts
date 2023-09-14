// Copyright 2023, University of Colorado Boulder

/**
 * How things can extend outside of their normal bounds (images, gradients, etc.)
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow } from '../imports.js';

enum RenderExtend {
  Pad = 0,
  Reflect = 1,
  Repeat = 2
}

export default RenderExtend;

alpenglow.register( 'RenderExtend', RenderExtend );
