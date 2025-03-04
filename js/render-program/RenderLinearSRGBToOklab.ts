// Copyright 2023-2025, University of Colorado Boulder

/**
 * RenderProgram to convert linear sRGB => Oklab
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import Vector4 from '../../../dot/js/Vector4.js';
import { alpenglow } from '../alpenglow.js';
import { RenderColorSpaceConversion } from './RenderColorSpaceConversion.js';
import { RenderProgram } from './RenderProgram.js';
import { RenderInstruction, RenderInstructionLocation } from './RenderInstruction.js';
import { RenderOklabToLinearSRGB } from './RenderOklabToLinearSRGB.js';
import type { RenderExecutionStack } from './RenderExecutionStack.js';
import type { RenderEvaluationContext } from './RenderEvaluationContext.js';
import type { RenderExecutor } from './RenderExecutor.js';
import type { ByteEncoder } from '../webgpu/compute/ByteEncoder.js';
import { RenderColor } from './RenderColor.js';

export class RenderLinearSRGBToOklab extends RenderColorSpaceConversion {
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

  public override writeInstructions( instructions: RenderInstruction[] ): void {
    this.program.writeInstructions( instructions );
    instructions.push( RenderInstructionLinearSRGBToOklab.INSTANCE );
  }
}

RenderLinearSRGBToOklab.prototype.inverse = RenderOklabToLinearSRGB;
RenderOklabToLinearSRGB.prototype.inverse = RenderLinearSRGBToOklab;

alpenglow.register( 'RenderLinearSRGBToOklab', RenderLinearSRGBToOklab );

const scratchVector = new Vector4( 0, 0, 0, 0 );

export class RenderInstructionLinearSRGBToOklab extends RenderInstruction {

  public override toString(): string {
    return 'RenderInstructionLinearSRGBToOklab()';
  }

  public override equals(
    other: RenderInstruction,
    areLocationsEqual: ( a: RenderInstructionLocation, b: RenderInstructionLocation ) => boolean
  ): boolean {
    return other instanceof RenderInstructionLinearSRGBToOklab;
  }

  public override execute(
    stack: RenderExecutionStack,
    context: RenderEvaluationContext,
    executor: RenderExecutor
  ): void {
    stack.readTop( scratchVector );

    const l = 0.4122214708 * scratchVector.x + 0.5363325363 * scratchVector.y + 0.0514459929 * scratchVector.z;
    const m = 0.2119034982 * scratchVector.x + 0.6806995451 * scratchVector.y + 0.1073969566 * scratchVector.z;
    const s = 0.0883024619 * scratchVector.x + 0.2817188376 * scratchVector.y + 0.6299787005 * scratchVector.z;

    const l_ = Math.cbrt( l );
    const m_ = Math.cbrt( m );
    const s_ = Math.cbrt( s );

    stack.writeTopValues(
      0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
      1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
      0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_,
      scratchVector.w
    );
  }

  public override writeBinary( encoder: ByteEncoder, getOffset: ( location: RenderInstructionLocation ) => number ): void {
    encoder.pushU32( RenderInstruction.LinearSRGBToOklabCode );
  }

  public override getBinaryLength(): number {
    return 1;
  }

  public static readonly INSTANCE = new RenderInstructionLinearSRGBToOklab();
}