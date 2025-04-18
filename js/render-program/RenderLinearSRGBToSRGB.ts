// Copyright 2023-2025, University of Colorado Boulder

/**
 * RenderProgram to convert linear sRGB => sRGB
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import Vector4 from '../../../dot/js/Vector4.js';
import { alpenglow } from '../alpenglow.js';
import { RenderColorSpaceConversion } from './RenderColorSpaceConversion.js';
import type { RenderProgram } from './RenderProgram.js';
import { RenderInstruction, RenderInstructionLocation } from './RenderInstruction.js';
import { RenderSRGBToLinearSRGB } from './RenderSRGBToLinearSRGB.js';
import type { RenderExecutionStack } from './RenderExecutionStack.js';
import type { RenderEvaluationContext } from './RenderEvaluationContext.js';
import type { RenderExecutor } from './RenderExecutor.js';
import type { ByteEncoder } from '../webgpu/compute/ByteEncoder.js';
import { RenderColor } from './RenderColor.js';

export class RenderLinearSRGBToSRGB extends RenderColorSpaceConversion {
  public constructor(
    program: RenderProgram
  ) {
    super( program, RenderColor.linearToSRGB );
  }

  public override getName(): string {
    return 'RenderLinearSRGBToSRGB';
  }

  public override withChildren( children: RenderProgram[] ): RenderLinearSRGBToSRGB {
    assert && assert( children.length === 1 );
    return new RenderLinearSRGBToSRGB( children[ 0 ] );
  }

  public override writeInstructions( instructions: RenderInstruction[] ): void {
    this.program.writeInstructions( instructions );
    instructions.push( RenderInstructionLinearSRGBToSRGB.INSTANCE );
  }
}

RenderLinearSRGBToSRGB.prototype.inverse = RenderSRGBToLinearSRGB;
RenderSRGBToLinearSRGB.prototype.inverse = RenderLinearSRGBToSRGB;

alpenglow.register( 'RenderLinearSRGBToSRGB', RenderLinearSRGBToSRGB );

const scratchVector = new Vector4( 0, 0, 0, 0 );

export class RenderInstructionLinearSRGBToSRGB extends RenderInstruction {

  public override toString(): string {
    return 'RenderInstructionLinearSRGBToSRGB()';
  }

  public override equals(
    other: RenderInstruction,
    areLocationsEqual: ( a: RenderInstructionLocation, b: RenderInstructionLocation ) => boolean
  ): boolean {
    return other instanceof RenderInstructionLinearSRGBToSRGB;
  }

  public override execute(
    stack: RenderExecutionStack,
    context: RenderEvaluationContext,
    executor: RenderExecutor
  ): void {
    // https://entropymine.com/imageworsener/srgbformula/ (a more precise formula for sRGB)
    // Linear to sRGB
    // 0 ≤ L ≤ 0.00313066844250063 : S = L×12.92
    // 0.00313066844250063 < L ≤ 1 : S = 1.055×L^1/2.4 − 0.055

    stack.readTop( scratchVector );
    stack.writeTopValues(
      scratchVector.x <= 0.00313066844250063 ? scratchVector.x * 12.92 : 1.055 * Math.pow( scratchVector.x, 1 / 2.4 ) - 0.055,
      scratchVector.y <= 0.00313066844250063 ? scratchVector.y * 12.92 : 1.055 * Math.pow( scratchVector.y, 1 / 2.4 ) - 0.055,
      scratchVector.z <= 0.00313066844250063 ? scratchVector.z * 12.92 : 1.055 * Math.pow( scratchVector.z, 1 / 2.4 ) - 0.055,
      scratchVector.w
    );
  }

  public override writeBinary( encoder: ByteEncoder, getOffset: ( location: RenderInstructionLocation ) => number ): void {
    encoder.pushU32( RenderInstruction.LinearSRGBToSRGBCode );
  }

  public override getBinaryLength(): number {
    return 1;
  }

  public static readonly INSTANCE = new RenderInstructionLinearSRGBToSRGB();
}