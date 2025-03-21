// Copyright 2023-2025, University of Colorado Boulder

/**
 * RenderProgram for normalizing the result of another RenderProgram
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import Vector4 from '../../../dot/js/Vector4.js';
import { alpenglow } from '../alpenglow.js';
import { RenderProgram, SerializedRenderProgram } from './RenderProgram.js';
import type { RenderEvaluationContext } from './RenderEvaluationContext.js';
import { RenderInstruction, RenderInstructionLocation } from './RenderInstruction.js';
import type { RenderExecutionStack } from './RenderExecutionStack.js';
import type { RenderExecutor } from './RenderExecutor.js';
import type { ByteEncoder } from '../webgpu/compute/ByteEncoder.js';
import { RenderColor } from './RenderColor.js';
import { RenderPathBoolean } from './RenderPathBoolean.js';

export class RenderNormalize extends RenderProgram {
  public constructor(
    public readonly program: RenderProgram
  ) {
    super(
      [ program ],
      program.isFullyTransparent,
      program.isFullyOpaque
    );
  }

  public override getName(): string {
    return 'RenderNormalize';
  }

  public override withChildren( children: RenderProgram[] ): RenderNormalize {
    assert && assert( children.length === 1 );
    return new RenderNormalize( children[ 0 ] );
  }

  protected override getSimplified( children: RenderProgram[] ): RenderProgram | null {
    const program = children[ 0 ];

    if ( program.isFullyTransparent ) {
      return RenderColor.TRANSPARENT;
    }
    else if ( program instanceof RenderColor ) {
      return new RenderColor( program.color.magnitude > 0 ? program.color.normalized() : Vector4.ZERO );
    }
    // Move our path-booleans "up" to the top level (so we can combine other things AND improve path-boolean replacement performance)
    else if ( program instanceof RenderPathBoolean && program.isOneSided() ) {
      return program.withOneSide( this.withChildren( [ program.getOneSide() ] ) ).simplified();
    }
    else {
      return null;
    }
  }

  public override evaluate( context: RenderEvaluationContext ): Vector4 {
    const source = this.program.evaluate( context );

    const magnitude = source.magnitude;
    if ( magnitude === 0 ) {
      return Vector4.ZERO;
    }
    else {
      assert && assert( source.normalized().isFinite() );

      return source.normalized();
    }
  }

  public override writeInstructions( instructions: RenderInstruction[] ): void {
    this.program.writeInstructions( instructions );
    instructions.push( RenderInstructionNormalize.INSTANCE );
  }

  public override serialize(): SerializedRenderNormalize {
    return {
      type: 'RenderNormalize',
      program: this.program.serialize()
    };
  }
}

alpenglow.register( 'RenderNormalize', RenderNormalize );

const scratchVector = new Vector4( 0, 0, 0, 0 );

export class RenderInstructionNormalize extends RenderInstruction {

  public override toString(): string {
    return 'RenderInstructionNormalize()';
  }

  public override equals(
    other: RenderInstruction,
    areLocationsEqual: ( a: RenderInstructionLocation, b: RenderInstructionLocation ) => boolean
  ): boolean {
    return other instanceof RenderInstructionNormalize;
  }

  public override execute(
    stack: RenderExecutionStack,
    context: RenderEvaluationContext,
    executor: RenderExecutor
  ): void {
    stack.readTop( scratchVector );

    const magnitude = scratchVector.magnitude;
    if ( magnitude === 0 ) {
      stack.writeTop( Vector4.ZERO );
    }
    else {
      stack.writeTopValues(
        scratchVector.x / magnitude,
        scratchVector.y / magnitude,
        scratchVector.z / magnitude,
        scratchVector.w / magnitude
      );
    }
  }

  public override writeBinary( encoder: ByteEncoder, getOffset: ( location: RenderInstructionLocation ) => number ): void {
    encoder.pushU32( RenderInstruction.NormalizeCode );
  }

  public override getBinaryLength(): number {
    return 1;
  }

  public static readonly INSTANCE = new RenderInstructionNormalize();
}

export type SerializedRenderNormalize = {
  type: 'RenderNormalize';
  program: SerializedRenderProgram;
};