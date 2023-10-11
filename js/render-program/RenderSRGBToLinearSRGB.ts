// Copyright 2023, University of Colorado Boulder

/**
 * RenderProgram to convert sRGB => linear sRGB
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { RenderColor, RenderColorSpaceConversion, RenderProgram, alpenglow, RenderInstruction, RenderExecutionStack, RenderEvaluationContext, RenderExecutor, ByteEncoder, RenderInstructionLocation } from '../imports.js';
import Vector4 from '../../../dot/js/Vector4.js';

export default class RenderSRGBToLinearSRGB extends RenderColorSpaceConversion {
  public constructor(
    program: RenderProgram
  ) {
    super( program, RenderColor.sRGBToLinear );
  }

  public override getName(): string {
    return 'RenderSRGBToLinearSRGB';
  }

  public override withChildren( children: RenderProgram[] ): RenderSRGBToLinearSRGB {
    assert && assert( children.length === 1 );
    return new RenderSRGBToLinearSRGB( children[ 0 ] );
  }

  public override writeInstructions( instructions: RenderInstruction[] ): void {
    this.program.writeInstructions( instructions );
    instructions.push( RenderInstructionSRGBToLinearSRGB.INSTANCE );
  }
}

alpenglow.register( 'RenderSRGBToLinearSRGB', RenderSRGBToLinearSRGB );

const scratchVector = new Vector4( 0, 0, 0, 0 );

export class RenderInstructionSRGBToLinearSRGB extends RenderInstruction {
  public override execute(
    stack: RenderExecutionStack,
    context: RenderEvaluationContext,
    executor: RenderExecutor
  ): void {
    // https://entropymine.com/imageworsener/srgbformula/ (a more precise formula for sRGB)
    // sRGB to Linear
    // 0 ≤ S ≤ 0.0404482362771082 : L = S/12.92
    // 0.0404482362771082 < S ≤ 1 : L = ((S+0.055)/1.055)^2.4

    stack.readTop( scratchVector );
    stack.writeTopValues(
      scratchVector.x <= 0.0404482362771082 ? scratchVector.x / 12.92 : Math.pow( ( scratchVector.x + 0.055 ) / 1.055, 2.4 ),
      scratchVector.y <= 0.0404482362771082 ? scratchVector.y / 12.92 : Math.pow( ( scratchVector.y + 0.055 ) / 1.055, 2.4 ),
      scratchVector.z <= 0.0404482362771082 ? scratchVector.z / 12.92 : Math.pow( ( scratchVector.z + 0.055 ) / 1.055, 2.4 ),
      scratchVector.w
    );
  }

  public override writeBinary( encoder: ByteEncoder, getOffset: ( location: RenderInstructionLocation ) => number ): void {
    encoder.pushU32( RenderInstruction.SRGBToLinearSRGBCode );
  }

  public override getBinaryLength(): number {
    return 1;
  }

  public static readonly INSTANCE = new RenderInstructionSRGBToLinearSRGB();
}
