// Copyright 2023-2024, University of Colorado Boulder

/**
 * A gradient stop for linear/radial gradients
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import Vector4 from '../../../dot/js/Vector4.js';
import { alpenglow } from '../alpenglow.js';
import { RenderProgram, SerializedRenderProgram } from './RenderProgram.js';
import type { RenderEvaluationContext } from './RenderEvaluationContext.js';
import { RenderColor } from './RenderColor.js';

export class RenderGradientStop {
  public constructor( public readonly ratio: number, public readonly program: RenderProgram ) {
    assert && assert( ratio >= 0 && ratio <= 1 );
  }

  public static evaluate(
    context: RenderEvaluationContext,
    stops: RenderGradientStop[],
    t: number
  ): Vector4 {
    let i = -1;
    while ( i < stops.length - 1 && stops[ i + 1 ].ratio < t ) {
      i++;
    }
    if ( i === -1 ) {
      return stops[ 0 ].program.evaluate( context );
    }
    else if ( i === stops.length - 1 ) {
      return stops[ i ].program.evaluate( context );
    }
    else {
      const before = stops[ i ];
      const after = stops[ i + 1 ];
      const ratio = ( t - before.ratio ) / ( after.ratio - before.ratio );

      const beforeColor = before.program.evaluate( context );
      const afterColor = after.program.evaluate( context );

      return RenderColor.ratioBlend( beforeColor, afterColor, ratio );
    }
  }

  public withProgram( program: RenderProgram ): RenderGradientStop {
    if ( program === this.program ) {
      return this;
    }

    return new RenderGradientStop( this.ratio, program );
  }

  public serialize(): SerializedRenderGradientStop {
    return {
      ratio: this.ratio,
      program: this.program.serialize()
    };
  }
}

alpenglow.register( 'RenderGradientStop', RenderGradientStop );

export type SerializedRenderGradientStop = {
  ratio: number;
  program: SerializedRenderProgram;
};