// Copyright 2023, University of Colorado Boulder

/**
 * Executes stack-based evaluation of a RenderProgram
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { RenderEvaluationContext, RenderInstruction, RenderInstructionLocation, alpenglow, RenderProgram, RenderEvaluator } from '../imports.js';
import RenderExecutionStack from './RenderExecutionStack.js';
import Vector4 from '../../../dot/js/Vector4.js';

// Should be kept empty
const scratchInstructions: RenderInstruction[] = [];

export default class RenderExecutor {

  private stack = new RenderExecutionStack();
  private indexStack: number[] = [];
  private instructions: RenderInstruction[] = [];
  private instructionIndex = 0;
  private isDone = false;

  public readonly evaluator: RenderEvaluator;

  public constructor() {
    this.evaluator = this.execute.bind( this );
  }

  public loadRenderProgram( renderProgram: RenderProgram ): void {
    renderProgram.writeInstructions( scratchInstructions );
    this.loadInstructions( scratchInstructions );
    scratchInstructions.length = 0;
  }

  public loadInstructions( instructions: RenderInstruction[] ): void {
    this.instructions.length = 0;

    for ( let i = 0; i < instructions.length; i++ ) {
      const instruction = instructions[ i ];

      // Don't actually insert locations. Just store the index for now.
      if ( instruction instanceof RenderInstructionLocation ) {
        instruction.index = this.instructions.length;
      }
      else {
        this.instructions.push( instruction );
      }
    }

    this.updateIndices();
  }

  public reset(): void {
    this.stack.reset();
    this.indexStack.length = 0;
    this.instructionIndex = 0;
    this.isDone = false;
  }

  public execute( context: RenderEvaluationContext, output: Vector4 ): Vector4 {
    const stack = this.stack;
    const instructions = this.instructions;

    this.stack.reset();
    this.indexStack.length = 0;
    this.instructionIndex = 0;
    this.isDone = false;

    // NOTE: Implicit "exit" at the end of any sequence
    while ( !this.isDone && this.instructionIndex < instructions.length ) {
      instructions[ this.instructionIndex++ ].execute( stack, context, this );
    }

    assert && assert( this.stack.getLength() === 1 );
    stack.popInto( output );

    return output;
  }

  public jump( location: RenderInstructionLocation ): void {
    this.instructionIndex = location.index;
  }

  public call( location: RenderInstructionLocation ): void {
    this.indexStack.push( this.instructionIndex );
    this.instructionIndex = location.index;
  }

  public return(): void {
    assert && assert( this.indexStack.length > 0 );
    this.instructionIndex = this.indexStack.pop()!;
  }

  public exit(): void {
    this.isDone = true;
  }

  private updateIndices(): void {
    for ( let i = 0; i < this.instructions.length; i++ ) {
      const instruction = this.instructions[ i ];
      if ( instruction instanceof RenderInstructionLocation ) {
        instruction.index = i;
      }
    }
  }
}

alpenglow.register( 'RenderExecutor', RenderExecutor );
