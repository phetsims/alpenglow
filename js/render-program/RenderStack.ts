// Copyright 2023-2025, University of Colorado Boulder

/**
 * RenderProgram for repeated compositing of multiple RenderPrograms in a row with normal blending and source-over
 * Porter-Duff composition.
 *
 * RenderStack will apply normal compositing/blending to a list of RenderPrograms, where each RenderProgram in the
 * list is drawn "on top" of all of the previous ones.
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
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

export class RenderStack extends RenderProgram {
  /**
   * @param children - Ordered from back to front, like Scenery's Node.children
   */
  public constructor(
    children: RenderProgram[]
  ) {
    super(
      children,
      _.every( children, RenderProgram.closureIsFullyTransparent ),
      _.some( children, RenderProgram.closureIsFullyOpaque )
    );
  }

  public override getName(): string {
    return 'RenderStack';
  }

  public override withChildren( children: RenderProgram[] ): RenderStack {
    assert && assert( children.length === this.children.length );
    return new RenderStack( children );
  }

  protected override getSimplified( children: RenderProgram[] ): RenderProgram | null {
    children = children.filter( child => !child.isFullyTransparent );

    // If there is an opaque child, nothing below it matters (drop everything before it)
    for ( let i = children.length - 1; i >= 0; i-- ) {
      const child = children[ i ];
      if ( child.isFullyOpaque ) {
        children = children.slice( i );
        break;
      }
    }

    // Collapse other RenderStacks into this one
    const collapsedChildren: RenderProgram[] = [];
    for ( let i = 0; i < children.length; i++ ) {
      const child = children[ i ];
      if ( child instanceof RenderStack ) {
        collapsedChildren.push( ...child.children );
      }
      else {
        collapsedChildren.push( child );
      }
    }
    children = collapsedChildren;

    // Attempt to blend adjacent colors
    const blendedChildren: RenderProgram[] = [];
    for ( let i = 0; i < children.length; i++ ) {
      const child = children[ i ];
      const lastChild = blendedChildren[ blendedChildren.length - 1 ];

      if ( i > 0 && child instanceof RenderColor && lastChild instanceof RenderColor ) {
        blendedChildren.pop();
        blendedChildren.push( new RenderColor( RenderStack.combine( child.color, lastChild.color ) ) );
      }
      else {
        blendedChildren.push( child );
      }
    }
    children = blendedChildren;

    if ( children.length === 0 ) {
      return RenderColor.TRANSPARENT;
    }
    else if ( children.length === 1 ) {
      return children[ 0 ];
    }
    else if ( this.children.length !== children.length || _.some( this.children, ( child, i ) => child !== children[ i ] ) ) {
      return new RenderStack( children );
    }
    else {
      return null;
    }
  }

  public static combine( a: Vector4, b: Vector4 ): Vector4 {
    const backgroundAlpha = 1 - a.w;

    return new Vector4(
      a.x + backgroundAlpha * b.x,
      a.y + backgroundAlpha * b.y,
      a.z + backgroundAlpha * b.z,
      a.w + backgroundAlpha * b.w
    );
  }

  public override evaluate( context: RenderEvaluationContext ): Vector4 {

    const numChildren = this.children.length;

    // Bail if we have zero children, since we'll do an initialization based on the last child
    if ( numChildren === 0 ) {
      return Vector4.ZERO;
    }

    // Initialize it with the "last" color, so we don't need to do any extra blending operations
    const lastColor = this.children[ numChildren - 1 ].evaluate( context );
    const color = lastColor.copy(); // we will mutate it, so we'll make a copy

    // We'll abuse the associativity of this blending operation to START with the "top" content. Thus each iteration
    // will add in the "background" color, bailing if we reach full opacity.
    // NOTE: the extra for-command condition
    for ( let i = this.children.length - 2; i >= 0 && color.w !== 1; i-- ) {
      const blendColor = this.children[ i ].evaluate( context );
      const backgroundAlpha = 1 - color.w;

      // Assume premultiplied
      color.setXYZW(
        backgroundAlpha * blendColor.x + color.x,
        backgroundAlpha * blendColor.y + color.y,
        backgroundAlpha * blendColor.z + color.z,
        backgroundAlpha * blendColor.w + color.w
      );
    }

    return color;
  }

  public override writeInstructions( instructions: RenderInstruction[] ): void {
    if ( !this.children.length ) {
      return;
    }

    // TODO: option to potentially write out things skipping the jump if it is simple? (so like... don't jump before RenderColors)

    const endLocation = new RenderInstructionLocation();
    const opaqueJump = new RenderInstructionOpaqueJump( endLocation ); // we'll have this listed multiple times
    const blend = RenderInstructionStackBlend.INSTANCE;

    this.children[ this.children.length - 1 ].writeInstructions( instructions );

    let hasJump = false;

    for ( let i = this.children.length - 2; i >= 0; i-- ) {
      if ( !RenderInstructionOpaqueJump.SKIP_RENDER_COLOR_JUMPS || !( this.children[ i ] instanceof RenderColor ) ) {
        instructions.push( opaqueJump );
        hasJump = true;
      }

      this.children[ i ].writeInstructions( instructions );
      instructions.push( blend );
    }

    if ( hasJump ) {
      instructions.push( endLocation );
    }
  }

  public override serialize(): SerializedRenderStack {
    return {
      type: 'RenderStack',
      children: this.children.map( child => child.serialize() )
    };
  }
}

alpenglow.register( 'RenderStack', RenderStack );

const scratchVector = new Vector4( 0, 0, 0, 0 );
const scratchVector2 = new Vector4( 0, 0, 0, 0 );

export class RenderInstructionOpaqueJump extends RenderInstruction {

  public constructor(
    public location: RenderInstructionLocation
  ) {
    super();
  }

  public override toString(): string {
    const location = `location:${this.location.id}`;
    return `RenderInstructionOpaqueJump(${location})`;
  }

  public override equals(
    other: RenderInstruction,
    areLocationsEqual: ( a: RenderInstructionLocation, b: RenderInstructionLocation ) => boolean
  ): boolean {
    return other instanceof RenderInstructionOpaqueJump && areLocationsEqual( this.location, other.location );
  }

  public static readonly SKIP_RENDER_COLOR_JUMPS = false;

  public override execute(
    stack: RenderExecutionStack,
    context: RenderEvaluationContext,
    executor: RenderExecutor
  ): void {
    const color = stack.readTop( scratchVector );
    if ( color.w === 1 ) {
      executor.jump( this.location );
    }
  }

  public override writeBinary( encoder: ByteEncoder, getOffset: ( location: RenderInstructionLocation ) => number ): void {
    const offset = getOffset( this.location );
    assert && assert( isFinite( offset ) && offset >= 0, 'Using unsigned for now' );

    encoder.pushU32(
      RenderInstruction.OpaqueJumpCode |
      offset << 8
    );
  }

  public static fromBinary(
    encoder: ByteEncoder,
    offset: number,
    getLocation: ( offset: number ) => RenderInstructionLocation
  ): RenderInstructionOpaqueJump {
    return new RenderInstructionOpaqueJump( getLocation( encoder.fullU32Array[ offset ] >> 8 ) );
  }

  public override getBinaryLength(): number {
    return 1;
  }
}

// Background on the top of the stack
export class RenderInstructionStackBlend extends RenderInstruction {

  public override toString(): string {
    return 'RenderInstructionStackBlend()';
  }

  public override equals(
    other: RenderInstruction,
    areLocationsEqual: ( a: RenderInstructionLocation, b: RenderInstructionLocation ) => boolean
  ): boolean {
    return other instanceof RenderInstructionStackBlend;
  }

  public override execute(
    stack: RenderExecutionStack,
    context: RenderEvaluationContext,
    executor: RenderExecutor
  ): void {
    const background = stack.popInto( scratchVector );
    const foreground = stack.readTop( scratchVector2 );

    const backgroundAlpha = 1 - foreground.w;

    // Assume premultiplied
    stack.writeTopValues(
      backgroundAlpha * background.x + foreground.x,
      backgroundAlpha * background.y + foreground.y,
      backgroundAlpha * background.z + foreground.z,
      backgroundAlpha * background.w + foreground.w
    );
  }

  public override writeBinary( encoder: ByteEncoder, getOffset: ( location: RenderInstructionLocation ) => number ): void {
    encoder.pushU32( RenderInstruction.StackBlendCode );
  }

  public override getBinaryLength(): number {
    return 1;
  }

  public static readonly INSTANCE = new RenderInstructionStackBlend();
}

export type SerializedRenderStack = {
  type: 'RenderStack';
  children: SerializedRenderProgram[];
};