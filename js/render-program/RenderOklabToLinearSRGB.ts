// Copyright 2023, University of Colorado Boulder

/**
 * RenderProgram to convert Oklab => linear sRGB
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { RenderColor, RenderColorSpaceConversion, RenderProgram, alpenglow, RenderInstruction, RenderExecutionStack, RenderEvaluationContext, RenderExecutor, ByteEncoder, RenderInstructionLocation } from '../imports.js';
import Vector4 from '../../../dot/js/Vector4.js';

export default class RenderOklabToLinearSRGB extends RenderColorSpaceConversion {
  public constructor(
    program: RenderProgram
  ) {
    super( program, RenderColor.oklabToLinear );
  }

  public override getName(): string {
    return 'RenderOklabToLinearSRGB';
  }

  public override withChildren( children: RenderProgram[] ): RenderOklabToLinearSRGB {
    assert && assert( children.length === 1 );
    return new RenderOklabToLinearSRGB( children[ 0 ] );
  }

  public override writeInstructions( instructions: RenderInstruction[] ): void {
    this.program.writeInstructions( instructions );
    instructions.push( RenderInstructionOklabToLinearSRGB.INSTANCE );
  }
}

alpenglow.register( 'RenderOklabToLinearSRGB', RenderOklabToLinearSRGB );

const scratchVector = new Vector4( 0, 0, 0, 0 );

export class RenderInstructionOklabToLinearSRGB extends RenderInstruction {
  public override execute(
    stack: RenderExecutionStack,
    context: RenderEvaluationContext,
    executor: RenderExecutor
  ): void {
    stack.readTop( scratchVector );

    const l_ = scratchVector.x + 0.3963377774 * scratchVector.y + 0.2158037573 * scratchVector.z;
    const m_ = scratchVector.x - 0.1055613458 * scratchVector.y - 0.0638541728 * scratchVector.z;
    const s_ = scratchVector.x - 0.0894841775 * scratchVector.y - 1.2914855480 * scratchVector.z;

    const l = l_ * l_ * l_;
    const m = m_ * m_ * m_;
    const s = s_ * s_ * s_;

    stack.writeTopValues(
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
      scratchVector.w
    );
  }

  public override writeBinary( encoder: ByteEncoder, getOffset: ( location: RenderInstructionLocation ) => number ): void {
    encoder.pushU32( RenderInstruction.OklabToLinearSRGBCode );
  }

  public static readonly INSTANCE = new RenderInstructionOklabToLinearSRGB();
}
