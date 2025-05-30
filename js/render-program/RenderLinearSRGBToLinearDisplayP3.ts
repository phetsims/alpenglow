// Copyright 2023-2025, University of Colorado Boulder

/**
 * RenderProgram to convert linear sRGB => linear Display P3
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import Vector4 from '../../../dot/js/Vector4.js';
import { alpenglow } from '../alpenglow.js';
import { RenderColorSpaceConversion } from './RenderColorSpaceConversion.js';
import { RenderProgram } from './RenderProgram.js';
import { RenderInstruction, RenderInstructionLocation } from './RenderInstruction.js';
import { RenderLinearDisplayP3ToLinearSRGB } from './RenderLinearDisplayP3ToLinearSRGB.js';
import type { RenderExecutionStack } from './RenderExecutionStack.js';
import type { RenderEvaluationContext } from './RenderEvaluationContext.js';
import type { RenderExecutor } from './RenderExecutor.js';
import type { ByteEncoder } from '../webgpu/compute/ByteEncoder.js';
import { RenderColor } from './RenderColor.js';

export class RenderLinearSRGBToLinearDisplayP3 extends RenderColorSpaceConversion {
  public constructor(
    program: RenderProgram
  ) {
    super( program, RenderColor.linearToLinearDisplayP3 );
  }

  public override getName(): string {
    return 'RenderLinearSRGBToLinearDisplayP3';
  }

  public override withChildren( children: RenderProgram[] ): RenderLinearSRGBToLinearDisplayP3 {
    assert && assert( children.length === 1 );
    return new RenderLinearSRGBToLinearDisplayP3( children[ 0 ] );
  }

  public override writeInstructions( instructions: RenderInstruction[] ): void {
    this.program.writeInstructions( instructions );
    instructions.push( RenderInstructionLinearSRGBToLinearDisplayP3.INSTANCE );
  }
}

RenderLinearSRGBToLinearDisplayP3.prototype.inverse = RenderLinearDisplayP3ToLinearSRGB;
RenderLinearDisplayP3ToLinearSRGB.prototype.inverse = RenderLinearSRGBToLinearDisplayP3;

alpenglow.register( 'RenderLinearSRGBToLinearDisplayP3', RenderLinearSRGBToLinearDisplayP3 );

const scratchVector = new Vector4( 0, 0, 0, 0 );

export class RenderInstructionLinearSRGBToLinearDisplayP3 extends RenderInstruction {

  public override toString(): string {
    return 'RenderInstructionLinearSRGBToLinearDisplayP3()';
  }

  public override equals(
    other: RenderInstruction,
    areLocationsEqual: ( a: RenderInstructionLocation, b: RenderInstructionLocation ) => boolean
  ): boolean {
    return other instanceof RenderInstructionLinearSRGBToLinearDisplayP3;
  }

  public override execute(
    stack: RenderExecutionStack,
    context: RenderEvaluationContext,
    executor: RenderExecutor
  ): void {
    const matrix = RenderColor.sRGBToDisplayP3Matrix;

    stack.readTop( scratchVector );

    stack.writeTopValues(
      matrix.m00() * scratchVector.x + matrix.m01() * scratchVector.y + matrix.m02() * scratchVector.z,
      matrix.m10() * scratchVector.x + matrix.m11() * scratchVector.y + matrix.m12() * scratchVector.z,
      matrix.m20() * scratchVector.x + matrix.m21() * scratchVector.y + matrix.m22() * scratchVector.z,
      scratchVector.w
    );
  }

  public override writeBinary( encoder: ByteEncoder, getOffset: ( location: RenderInstructionLocation ) => number ): void {
    encoder.pushU32( RenderInstruction.LinearSRGBToLinearDisplayP3Code );
  }

  public override getBinaryLength(): number {
    return 1;
  }

  public static readonly INSTANCE = new RenderInstructionLinearSRGBToLinearDisplayP3();
}