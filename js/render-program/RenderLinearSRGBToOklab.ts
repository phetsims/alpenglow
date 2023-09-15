// Copyright 2023, University of Colorado Boulder

/**
 * RenderProgram to convert linear sRGB => Oklab
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { RenderColor, RenderColorSpaceConversion, RenderOklabToLinearSRGB, RenderProgram, alpenglow } from '../imports.js';

export default class RenderLinearSRGBToOklab extends RenderColorSpaceConversion {
  public constructor(
    program: RenderProgram
  ) {
    super( program, RenderColor.linearToOklab );
  }

  public override getName(): string {
    return 'RenderLinearSRGBToOklab';
  }

  public override withChildren( children: RenderProgram[] ): RenderLinearSRGBToOklab {
    assert && assert( children.length === 1 );
    return new RenderLinearSRGBToOklab( children[ 0 ] );
  }
}

RenderLinearSRGBToOklab.prototype.inverse = RenderOklabToLinearSRGB;
RenderOklabToLinearSRGB.prototype.inverse = RenderLinearSRGBToOklab;

alpenglow.register( 'RenderLinearSRGBToOklab', RenderLinearSRGBToOklab );