// Copyright 2023-2024, University of Colorado Boulder

/**
 * RenderProgram to unpremultiply the input color
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import Vector4 from '../../../dot/js/Vector4.js';
import { alpenglow, ByteEncoder, RenderColor, RenderColorSpaceConversion, RenderEvaluationContext, RenderExecutionStack, RenderExecutor, RenderInstruction, RenderInstructionLocation, RenderPremultiply, RenderProgram } from '../imports.js';

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

  public override toString(): string {
    return 'RenderInstructionUnpremultiply()';
  }

  public override equals(
    other: RenderInstruction,
    areLocationsEqual: ( a: RenderInstructionLocation, b: RenderInstructionLocation ) => boolean
  ): boolean {
    return other instanceof RenderInstructionUnpremultiply;
  }

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

  public override writeBinary( encoder: ByteEncoder, getOffset: ( location: RenderInstructionLocation ) => number ): void {
    encoder.pushU32( RenderInstruction.UnpremultiplyCode );
  }

  public override getBinaryLength(): number {
    return 1;
  }

  public static readonly INSTANCE = new RenderInstructionUnpremultiply();
}