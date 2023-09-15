// Copyright 2023, University of Colorado Boulder

/**
 * RenderProgram for a triangular barycentric blend.
 *
 * NOTE: Does not apply perspective correction, is purely a 2d blend.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { RenderColor, RenderEvaluationContext, RenderExecutionStack, RenderExecutor, RenderInstruction, RenderProgram, alpenglow, SerializedRenderProgram } from '../imports.js';
import Vector2 from '../../../dot/js/Vector2.js';
import Matrix3 from '../../../dot/js/Matrix3.js';
import Vector4 from '../../../dot/js/Vector4.js';

export enum RenderBarycentricBlendAccuracy {
  Accurate = 0,
  PixelCenter = 1
}

const scratchCentroid = new Vector2( 0, 0 );

alpenglow.register( 'RenderBarycentricBlendAccuracy', RenderBarycentricBlendAccuracy );

export default class RenderBarycentricBlend extends RenderProgram {

  public readonly logic: RenderBarycentricBlendLogic;

  public constructor(
    public readonly pointA: Vector2,
    public readonly pointB: Vector2,
    public readonly pointC: Vector2,
    public readonly accuracy: RenderBarycentricBlendAccuracy,
    public readonly a: RenderProgram,
    public readonly b: RenderProgram,
    public readonly c: RenderProgram,
    logic?: RenderBarycentricBlendLogic
  ) {
    assert && assert( pointA.isFinite() );
    assert && assert( pointB.isFinite() );
    assert && assert( pointC.isFinite() );
    assert && assert( !pointA.equals( pointB ) );
    assert && assert( !pointB.equals( pointC ) );
    assert && assert( !pointC.equals( pointA ) );

    super(
      [ a, b, c ],
      a.isFullyTransparent && b.isFullyTransparent && c.isFullyTransparent,
      a.isFullyOpaque && b.isFullyOpaque && c.isFullyOpaque,
      false,
      false,
      accuracy === RenderBarycentricBlendAccuracy.Accurate
    );

    this.logic = logic || new RenderBarycentricBlendLogic( this.pointA, this.pointB, this.pointC, this.accuracy );
  }

  public override getName(): string {
    return 'RenderBarycentricBlend';
  }

  public override withChildren( children: RenderProgram[] ): RenderBarycentricBlend {
    assert && assert( children.length === 3 );
    return new RenderBarycentricBlend( this.pointA, this.pointB, this.pointC, this.accuracy, children[ 0 ], children[ 1 ], children[ 2 ], this.logic );
  }

  public override transformed( transform: Matrix3 ): RenderProgram {
    return new RenderBarycentricBlend(
      transform.timesVector2( this.pointA ),
      transform.timesVector2( this.pointB ),
      transform.timesVector2( this.pointC ),
      this.accuracy,
      this.a.transformed( transform ),
      this.b.transformed( transform ),
      this.c.transformed( transform )
    );
  }

  protected override equalsTyped( other: this ): boolean {
    return this.pointA.equals( other.pointA ) &&
           this.pointB.equals( other.pointB ) &&
           this.pointC.equals( other.pointC ) &&
           this.accuracy === other.accuracy;
  }

  public override getSimplified( children: RenderProgram[] ): RenderProgram | null {
    const a = children[ 0 ];
    const b = children[ 1 ];
    const c = children[ 2 ];

    if ( a.isFullyTransparent && b.isFullyTransparent && c.isFullyTransparent ) {
      return RenderColor.TRANSPARENT;
    }
    else if ( a.equals( b ) && a.equals( c ) ) {
      return a;
    }
    else {
      return null;
    }
  }

  public override evaluate( context: RenderEvaluationContext ): Vector4 {

    const aColor = this.a.evaluate( context );
    const bColor = this.b.evaluate( context );
    const cColor = this.c.evaluate( context );

    const vector = new Vector4( 0, 0, 0, 0 );
    RenderBarycentricBlend.applyProgram(
      vector, context, this.logic, aColor, bColor, cColor
    );
    return vector;
  }

  // TODO: Separation of logic and evaluation context
  public static applyProgram(
    vector: Vector4,
    context: RenderEvaluationContext,
    logic: RenderBarycentricBlendLogic,
    aColor: Vector4,
    bColor: Vector4,
    cColor: Vector4
  ): void {
    if ( assert ) {
      if ( logic.accuracy === RenderBarycentricBlendAccuracy.Accurate ) {
        assert( context.hasCentroid() );
      }
    }

    const point = logic.accuracy === RenderBarycentricBlendAccuracy.Accurate ? context.centroid : context.writeBoundsCentroid( scratchCentroid );
    const pA = logic.pointA;
    const pB = logic.pointB;
    const pC = logic.pointC;

    // TODO: can precompute things like this!!!
    // TODO: factor out common things!
    const det = ( pB.y - pC.y ) * ( pA.x - pC.x ) + ( pC.x - pB.x ) * ( pA.y - pC.y );

    const lambdaA = ( ( pB.y - pC.y ) * ( point.x - pC.x ) + ( pC.x - pB.x ) * ( point.y - pC.y ) ) / det;
    const lambdaB = ( ( pC.y - pA.y ) * ( point.x - pC.x ) + ( pA.x - pC.x ) * ( point.y - pC.y ) ) / det;
    const lambdaC = 1 - lambdaA - lambdaB;

    vector.setXYZW(
      aColor.x * lambdaA + bColor.x * lambdaB + cColor.x * lambdaC,
      aColor.y * lambdaA + bColor.y * lambdaB + cColor.y * lambdaC,
      aColor.z * lambdaA + bColor.z * lambdaB + cColor.z * lambdaC,
      aColor.w * lambdaA + bColor.w * lambdaB + cColor.w * lambdaC
    );
  }

  public override writeInstructions( instructions: RenderInstruction[] ): void {
    this.c.writeInstructions( instructions );
    this.b.writeInstructions( instructions );
    this.a.writeInstructions( instructions );
    instructions.push( new RenderInstructionBarycentricBlend( this.logic ) );
  }

  public override serialize(): SerializedRenderBarycentricBlend {
    return {
      type: 'RenderBarycentricBlend',
      pointA: [ this.pointA.x, this.pointA.y ],
      pointB: [ this.pointB.x, this.pointB.y ],
      pointC: [ this.pointC.x, this.pointC.y ],
      accuracy: this.accuracy,
      a: this.a.serialize(),
      b: this.b.serialize(),
      c: this.c.serialize()
    };
  }

  public static override deserialize( obj: SerializedRenderBarycentricBlend ): RenderBarycentricBlend {
    return new RenderBarycentricBlend(
      new Vector2( obj.pointA[ 0 ], obj.pointA[ 1 ] ),
      new Vector2( obj.pointB[ 0 ], obj.pointB[ 1 ] ),
      new Vector2( obj.pointC[ 0 ], obj.pointC[ 1 ] ),
      obj.accuracy,
      RenderProgram.deserialize( obj.a ),
      RenderProgram.deserialize( obj.b ),
      RenderProgram.deserialize( obj.c )
    );
  }
}

alpenglow.register( 'RenderBarycentricBlend', RenderBarycentricBlend );

export class RenderBarycentricBlendLogic {
  // TODO: Update this so we store the better logic
  public constructor(
    public readonly pointA: Vector2,
    public readonly pointB: Vector2,
    public readonly pointC: Vector2,
    public readonly accuracy: RenderBarycentricBlendAccuracy
  ) {}
}

const scratchAColor = new Vector4( 0, 0, 0, 0 );
const scratchBColor = new Vector4( 0, 0, 0, 0 );
const scratchCColor = new Vector4( 0, 0, 0, 0 );
const scratchResult = new Vector4( 0, 0, 0, 0 );

export class RenderInstructionBarycentricBlend extends RenderInstruction {
  public constructor(
    public readonly logic: RenderBarycentricBlendLogic
  ) {
    super();
  }

  public override execute(
    stack: RenderExecutionStack,
    context: RenderEvaluationContext,
    executor: RenderExecutor
  ): void {
    const aColor = stack.popInto( scratchAColor );
    const bColor = stack.popInto( scratchBColor );
    const cColor = stack.popInto( scratchCColor );

    RenderBarycentricBlend.applyProgram(
      scratchResult, context, this.logic, aColor, bColor, cColor
    );
    stack.push( scratchResult );
  }
}

export type SerializedRenderBarycentricBlend = {
  type: 'RenderBarycentricBlend';
  pointA: number[];
  pointB: number[];
  pointC: number[];
  accuracy: RenderBarycentricBlendAccuracy;
  a: SerializedRenderProgram;
  b: SerializedRenderProgram;
  c: SerializedRenderProgram;
};