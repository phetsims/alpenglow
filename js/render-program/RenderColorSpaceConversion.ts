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
import { RenderEvaluationContext } from './RenderEvaluationContext.js';
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