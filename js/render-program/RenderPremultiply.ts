// Copyright 2023-2025, University of Colorado Boulder

/**
 * RenderProgram to premultiply the input color
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import Vector4 from '../../../dot/js/Vector4.js';
import { alpenglow } from '../alpenglow.js';
import { RenderColorSpaceConversion } from './RenderColorSpaceConversion.js';
import { RenderProgram } from './RenderProgram.js';
import { RenderInstruction, RenderInstructionLocation } from './RenderInstruction.js';
import type { RenderExecutionStack } from './RenderExecutionStack.js';
import type { RenderEvaluationContext } from './RenderEvaluationContext.js';
import type { RenderExecutor } from './RenderExecutor.js';
import type { ByteEncoder } from '../webgpu/compute/ByteEncoder.js';
import { RenderColor } from './RenderColor.js';

export class RenderPremultiply extends RenderColorSpaceConversion {
  public constructor(
    program: RenderProgram
  ) {
    super( program, RenderColor.premultiply );
  }

  public override getName(): string {
    return 'RenderPremultiply';
  }

  public override withChildren( children: RenderProgram[] ): RenderPremultiply {
    assert && assert( children.length === 1 );
    return new RenderPremultiply( children[ 0 ] );
  }

  public override writeInstructions( instructions: RenderInstruction[] ): void {
    this.program.writeInstructions( instructions );
    instructions.push( RenderInstructionPremultiply.INSTANCE );
  }
}

alpenglow.register( 'RenderPremultiply', RenderPremultiply );

const scratchVector = new Vector4( 0, 0, 0, 0 );

export class RenderInstructionPremultiply extends RenderInstruction {

  public override toString(): string {
    return 'RenderInstructionPremultiply()';
  }

  public override equals(
    other: RenderInstruction,
    areLocationsEqual: ( a: RenderInstructionLocation, b: RenderInstructionLocation ) => boolean
  ): boolean {
    return other instanceof RenderInstructionPremultiply;
  }

  public override execute(
    stack: RenderExecutionStack,
    context: RenderEvaluationContext,
    executor: RenderExecutor
  ): void {
    stack.readTop( scratchVector );
    stack.writeTopValues(
      scratchVector.x * scratchVector.w,
      scratchVector.y * scratchVector.w,
      scratchVector.z * scratchVector.w,
      scratchVector.w
    );
  }

  public override writeBinary( encoder: ByteEncoder, getOffset: ( location: RenderInstructionLocation ) => number ): void {
    encoder.pushU32( RenderInstruction.PremultiplyCode );
  }

  public override getBinaryLength(): number {
    return 1;
  }

  public static readonly INSTANCE = new RenderInstructionPremultiply();
}