// Copyright 2023, University of Colorado Boulder

/**
 * RenderProgram to unpremultiply the input color
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { RenderColor, RenderColorSpaceConversion, RenderPremultiply, RenderProgram, alpenglow, RenderInstruction, RenderExecutionStack, RenderEvaluationContext, RenderExecutor } from '../imports.js';
import Vector4 from '../../../dot/js/Vector4.js';

export default class RenderUnpremultiply extends RenderColorSpaceConversion {
  public constructor(
    program: RenderProgram
  ) {
    super( program, RenderColor.unpremultiply );
  }

  public override getName(): string {
    return 'RenderUnpremultiply';
  }

  public override withChildren( children: RenderProgram[] ): RenderUnpremultiply {
    assert && assert( children.length === 1 );
    return new RenderUnpremultiply( children[ 0 ] );
  }

  public override writeInstructions( instructions: RenderInstruction[] ): void {
    this.program.writeInstructions( instructions );
    instructions.push( RenderInstructionUnpremultiply.INSTANCE );
  }
}

RenderPremultiply.prototype.inverse = RenderUnpremultiply;
RenderUnpremultiply.prototype.inverse = RenderPremultiply;

alpenglow.register( 'RenderUnpremultiply', RenderUnpremultiply );

const scratchVector = new Vector4( 0, 0, 0, 0 );

export class RenderInstructionUnpremultiply extends RenderInstruction {
  public override execute(
    stack: RenderExecutionStack,
    context: RenderEvaluationContext,
    executor: RenderExecutor
  ): void {
    stack.readTop( scratchVector );
    const alpha = scratchVector.w;
    if ( alpha === 0 ) {
      stack.writeTop( Vector4.ZERO );
    }
    else {
      stack.writeTopValues(
        scratchVector.x / alpha,
        scratchVector.y / alpha,
        scratchVector.z / alpha,
        alpha
      );
    }
  }

  public static readonly INSTANCE = new RenderInstructionUnpremultiply();
}
