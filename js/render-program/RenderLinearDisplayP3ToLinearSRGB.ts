// Copyright 2023, University of Colorado Boulder

/**
 * RenderProgram to convert linear Display P3 => linear sRGB
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, ByteEncoder, RenderColor, RenderColorSpaceConversion, RenderEvaluationContext, RenderExecutionStack, RenderExecutor, RenderInstruction, RenderInstructionLocation, RenderProgram } from '../imports.js';
import Vector4 from '../../../dot/js/Vector4.js';

export default class RenderLinearDisplayP3ToLinearSRGB extends RenderColorSpaceConversion {
  public constructor(
    program: RenderProgram
  ) {
    super( program, RenderColor.linearDisplayP3ToLinear );
  }

  public override getName(): string {
    return 'RenderLinearDisplayP3ToLinearSRGB';
  }

  public override withChildren( children: RenderProgram[] ): RenderLinearDisplayP3ToLinearSRGB {
    assert && assert( children.length === 1 );
    return new RenderLinearDisplayP3ToLinearSRGB( children[ 0 ] );
  }

  public override writeInstructions( instructions: RenderInstruction[] ): void {
    this.program.writeInstructions( instructions );
    instructions.push( RenderInstructionLinearDisplayP3ToLinearSRGB.INSTANCE );
  }
}

alpenglow.register( 'RenderLinearDisplayP3ToLinearSRGB', RenderLinearDisplayP3ToLinearSRGB );

const scratchVector = new Vector4( 0, 0, 0, 0 );

export class RenderInstructionLinearDisplayP3ToLinearSRGB extends RenderInstruction {

  public override toString(): string {
    return 'RenderInstructionLinearDisplayP3ToLinearSRGB()';
  }

  public override equals(
    other: RenderInstruction,
    areLocationsEqual: ( a: RenderInstructionLocation, b: RenderInstructionLocation ) => boolean
  ): boolean {
    return other instanceof RenderInstructionLinearDisplayP3ToLinearSRGB;
  }

  public override execute(
    stack: RenderExecutionStack,
    context: RenderEvaluationContext,
    executor: RenderExecutor
  ): void {
    const matrix = RenderColor.displayP3TosRGBMatrix;

    stack.readTop( scratchVector );

    stack.writeTopValues(
      matrix.m00() * scratchVector.x + matrix.m01() * scratchVector.y + matrix.m02() * scratchVector.z,
      matrix.m10() * scratchVector.x + matrix.m11() * scratchVector.y + matrix.m12() * scratchVector.z,
      matrix.m20() * scratchVector.x + matrix.m21() * scratchVector.y + matrix.m22() * scratchVector.z,
      scratchVector.w
    );
  }

  public override writeBinary( encoder: ByteEncoder, getOffset: ( location: RenderInstructionLocation ) => number ): void {
    encoder.pushU32( RenderInstruction.LinearDisplayP3ToLinearSRGBCode );
  }

  public override getBinaryLength(): number {
    return 1;
  }

  public static readonly INSTANCE = new RenderInstructionLinearDisplayP3ToLinearSRGB();
}