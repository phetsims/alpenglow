// Copyright 2023, University of Colorado Boulder

/**
 * RenderProgram for showing normals colored for debugging
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { RenderColor, RenderEvaluationContext, RenderProgram, alpenglow, SerializedRenderProgram, RenderInstruction, RenderExecutionStack, RenderExecutor } from '../imports.js';
import Vector4 from '../../../dot/js/Vector4.js';

export default class RenderNormalDebug extends RenderProgram {
  public constructor(
    public readonly normalProgram: RenderProgram
  ) {
    super(
      [ normalProgram ],
      false,
      false
    );
  }

  public override getName(): string {
    return 'RenderNormalDebug';
  }

  public override withChildren( children: RenderProgram[] ): RenderNormalDebug {
    assert && assert( children.length === 1 );
    return new RenderNormalDebug( children[ 0 ] );
  }

  protected override equalsTyped( other: this ): boolean {
    return true;
  }

  protected override getSimplified( children: RenderProgram[] ): RenderProgram | null {
    const normalProgram = children[ 0 ];

    if ( normalProgram.isFullyTransparent ) {
      return RenderColor.TRANSPARENT;
    }
    else if ( normalProgram instanceof RenderColor ) {
      return new RenderColor( this.getNormalDebug( normalProgram.color ) );
    }
    else {
      return null;
    }
  }

  public getNormalDebug( normal: Vector4 ): Vector4 {
    assert && assert( normal.isFinite() );

    return new Vector4(
      normal.x * 0.5 + 0.5,
      normal.y * 0.5 + 0.5,
      normal.z * 0.5 + 0.5,
      1
    );
  }

  public override evaluate( context: RenderEvaluationContext ): Vector4 {
    const normal = this.normalProgram.evaluate( context );

    return this.getNormalDebug( normal );
  }

  public override writeInstructions( instructions: RenderInstruction[] ): void {
    this.normalProgram.writeInstructions( instructions );
    instructions.push( RenderInstructionNormalDebug.INSTANCE );
  }

  public override serialize(): SerializedRenderNormalDebug {
    return {
      type: 'RenderNormalDebug',
      normalProgram: this.normalProgram.serialize()
    };
  }

  public static override deserialize( obj: SerializedRenderNormalDebug ): RenderNormalDebug {
    return new RenderNormalDebug( RenderProgram.deserialize( obj.normalProgram ) );
  }
}

alpenglow.register( 'RenderNormalDebug', RenderNormalDebug );

const scratchVector = new Vector4( 0, 0, 0, 0 );

export class RenderInstructionNormalDebug extends RenderInstruction {
  public override execute(
    stack: RenderExecutionStack,
    context: RenderEvaluationContext,
    executor: RenderExecutor
  ): void {
    stack.readTop( scratchVector );
    stack.writeTopValues(
      scratchVector.x * 0.5 + 0.5,
      scratchVector.y * 0.5 + 0.5,
      scratchVector.z * 0.5 + 0.5,
      1
    );
  }

  public static readonly INSTANCE = new RenderInstructionNormalDebug();
}

export type SerializedRenderNormalDebug = {
  type: 'RenderNormalDebug';
  normalProgram: SerializedRenderProgram;
};
