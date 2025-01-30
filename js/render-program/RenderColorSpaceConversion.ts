// Copyright 2023-2024, University of Colorado Boulder

/**
 * RenderProgram to convert between color spaces. Should not change whether something is transparent or opaque
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import Vector4 from '../../../dot/js/Vector4.js';
import Constructor from '../../../phet-core/js/types/Constructor.js';
import { alpenglow } from '../alpenglow.js';
import { RenderProgram, SerializedRenderProgram } from './RenderProgram.js';
import { RenderColorSpace } from './RenderColorSpace.js';
import { RenderUnpremultiply } from './RenderUnpremultiply.js';
import { RenderPremultiply } from './RenderPremultiply.js';
import { RenderEvaluationContext } from './RenderEvaluationContext.js';
import { RenderLinearDisplayP3ToLinearSRGB } from './RenderLinearDisplayP3ToLinearSRGB.js';
import { RenderSRGBToLinearSRGB } from './RenderSRGBToLinearSRGB.js';
import { RenderLinearSRGBToLinearDisplayP3 } from './RenderLinearSRGBToLinearDisplayP3.js';
import { RenderOklabToLinearSRGB } from './RenderOklabToLinearSRGB.js';
import { RenderLinearSRGBToOklab } from './RenderLinearSRGBToOklab.js';
import { RenderLinearSRGBToSRGB } from './RenderLinearSRGBToSRGB.js';
import { RenderPathBoolean } from './RenderPathBoolean.js';
import { RenderColor } from './RenderColor.js';

export abstract class RenderColorSpaceConversion extends RenderProgram {

  public inverse?: Constructor<RenderColorSpaceConversion>;

  protected constructor(
    public readonly program: RenderProgram,
    public readonly convert: ( color: Vector4 ) => Vector4
  ) {
    super(
      [ program ],
      program.isFullyTransparent,
      program.isFullyOpaque
    );
  }

  // TODO: add a helper on RenderProgram
  public static convert( renderProgram: RenderProgram, fromSpace: RenderColorSpace, toSpace: RenderColorSpace ): RenderProgram {
    if ( fromSpace === toSpace ) {
      return renderProgram;
    }

    if ( fromSpace.isPremultiplied ) {
      renderProgram = new RenderUnpremultiply( renderProgram );
    }
    if ( !fromSpace.isLinear ) {
      renderProgram = fromSpace.toLinearRenderProgram!( renderProgram );
    }
    renderProgram = fromSpace.linearToLinearSRGBRenderProgram!( renderProgram );
    renderProgram = toSpace.linearSRGBToLinearRenderProgram!( renderProgram );
    if ( !toSpace.isLinear ) {
      renderProgram = toSpace.fromLinearRenderProgram!( renderProgram );
    }
    if ( toSpace.isPremultiplied ) {
      renderProgram = new RenderPremultiply( renderProgram );
    }
    return renderProgram.simplified();
  }

  protected override getSimplified( children: RenderProgram[] ): RenderProgram | null {
    const program = children[ 0 ];

    if ( program.isFullyTransparent ) {
      return RenderColor.TRANSPARENT;
    }
    else if ( program instanceof RenderColor ) {
      return new RenderColor( this.convert( program.color ) );
    }
    else if ( this.inverse && program instanceof this.inverse ) {
      return program.program;
    }
    // Move our path-booleans "up" to the top level (so we can combine other things AND improve path-boolean replacement performance)
    else if ( program instanceof RenderPathBoolean && program.isOneSided() ) {
      return program.withOneSide( this.withChildren( [ program.getOneSide() ] ) ).simplified();
    }
    else {
      return null;
    }
  }

  public override evaluate( context: RenderEvaluationContext ): Vector4 {
    const source = this.program.evaluate( context );

    return this.convert( source );
  }

  public static displayP3ToSRGB( renderProgram: RenderProgram ): RenderProgram {
    return new RenderLinearSRGBToSRGB( new RenderLinearDisplayP3ToLinearSRGB( new RenderSRGBToLinearSRGB( renderProgram ) ) );
  }

  public static sRGBToDisplayP3( renderProgram: RenderProgram ): RenderProgram {
    return new RenderLinearSRGBToSRGB( new RenderLinearSRGBToLinearDisplayP3( new RenderSRGBToLinearSRGB( renderProgram ) ) );
  }

  public static displayP3ToLinearSRGB( renderProgram: RenderProgram ): RenderProgram {
    return new RenderLinearDisplayP3ToLinearSRGB( new RenderSRGBToLinearSRGB( renderProgram ) );
  }

  public static linearSRGBToDisplayP3( renderProgram: RenderProgram ): RenderProgram {
    return new RenderLinearSRGBToSRGB( new RenderLinearSRGBToLinearDisplayP3( renderProgram ) );
  }

  public static oklabToSRGB( renderProgram: RenderProgram ): RenderProgram {
    return new RenderLinearSRGBToSRGB( new RenderOklabToLinearSRGB( renderProgram ) );
  }

  public static sRGBToOklab( renderProgram: RenderProgram ): RenderProgram {
    return new RenderLinearSRGBToOklab( new RenderSRGBToLinearSRGB( renderProgram ) );
  }

  public static oklabToDisplayP3( renderProgram: RenderProgram ): RenderProgram {
    return new RenderLinearSRGBToSRGB( new RenderLinearSRGBToLinearDisplayP3( new RenderOklabToLinearSRGB( renderProgram ) ) );
  }

  public static displayP3ToOklab( renderProgram: RenderProgram ): RenderProgram {
    return new RenderLinearSRGBToOklab( new RenderLinearDisplayP3ToLinearSRGB( new RenderSRGBToLinearSRGB( renderProgram ) ) );
  }

  public static premulSRGBToPremulLinearSRGB( renderProgram: RenderProgram ): RenderProgram {
    return new RenderPremultiply( new RenderSRGBToLinearSRGB( new RenderUnpremultiply( renderProgram ) ) );
  }

  public static premulLinearSRGBToPremulSRGB( renderProgram: RenderProgram ): RenderProgram {
    return new RenderPremultiply( new RenderLinearSRGBToSRGB( new RenderUnpremultiply( renderProgram ) ) );
  }

  public static premulLinearSRGBToPremulDisplayP3( renderProgram: RenderProgram ): RenderProgram {
    return new RenderPremultiply( RenderColorSpaceConversion.linearSRGBToDisplayP3( new RenderUnpremultiply( renderProgram ) ) );
  }

  public static premulDisplayP3ToPremulLinearSRGB( renderProgram: RenderProgram ): RenderProgram {
    return new RenderPremultiply( RenderColorSpaceConversion.displayP3ToLinearSRGB( new RenderUnpremultiply( renderProgram ) ) );
  }

  public static premulDisplayP3ToPremulSRGB( renderProgram: RenderProgram ): RenderProgram {
    return new RenderPremultiply( RenderColorSpaceConversion.displayP3ToSRGB( new RenderUnpremultiply( renderProgram ) ) );
  }

  public static premulSRGBToPremulDisplayP3( renderProgram: RenderProgram ): RenderProgram {
    return new RenderPremultiply( RenderColorSpaceConversion.sRGBToDisplayP3( new RenderUnpremultiply( renderProgram ) ) );
  }

  public static premulOklabToPremulSRGB( renderProgram: RenderProgram ): RenderProgram {
    return new RenderPremultiply( RenderColorSpaceConversion.oklabToSRGB( new RenderUnpremultiply( renderProgram ) ) );
  }

  public static premulSRGBToPremulOklab( renderProgram: RenderProgram ): RenderProgram {
    return new RenderPremultiply( RenderColorSpaceConversion.sRGBToOklab( new RenderUnpremultiply( renderProgram ) ) );
  }

  public static premulOklabToPremulDisplayP3( renderProgram: RenderProgram ): RenderProgram {
    return new RenderPremultiply( RenderColorSpaceConversion.oklabToDisplayP3( new RenderUnpremultiply( renderProgram ) ) );
  }

  public static premulDisplayP3ToPremulOklab( renderProgram: RenderProgram ): RenderProgram {
    return new RenderPremultiply( RenderColorSpaceConversion.displayP3ToOklab( new RenderUnpremultiply( renderProgram ) ) );
  }

  public override serialize(): SerializedRenderColorSpaceConversion {
    return {
      type: 'RenderColorSpaceConversion',
      subtype: this.getName(),
      program: this.program.serialize()
    };
  }
}

alpenglow.register( 'RenderColorSpaceConversion', RenderColorSpaceConversion );

export type SerializedRenderColorSpaceConversion = {
  type: 'RenderColorSpaceConversion';
  subtype: string;
  program: SerializedRenderProgram;
};