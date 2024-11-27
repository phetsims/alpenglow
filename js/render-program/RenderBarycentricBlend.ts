// Copyright 2023-2024, University of Colorado Boulder

/**
 * RenderProgram for a triangular barycentric blend.
 *
 * NOTE: Does not apply perspective correction, is purely a 2d blend.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import Matrix3 from '../../../dot/js/Matrix3.js';
import Vector2 from '../../../dot/js/Vector2.js';
import Vector4 from '../../../dot/js/Vector4.js';
import { alpenglow, ByteEncoder, RenderColor, RenderEvaluationContext, RenderExecutionStack, RenderExecutor, RenderInstruction, RenderInstructionLocation, RenderProgram, SerializedRenderProgram } from '../imports.js';


// REVIEW: What does the accuracy do?
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

    this.logic = logic || RenderBarycentricBlendLogic.from( this.pointA, this.pointB, this.pointC, this.accuracy );
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

  protected override getSimplified( children: RenderProgram[] ): RenderProgram | null {
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
    this.logic.apply( vector, context, aColor, bColor, cColor );
    return vector;
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

  public constructor(
    public readonly det: number,
    public readonly diffA: Vector2,
    public readonly diffB: Vector2,
    public readonly pointC: Vector2,
    public readonly accuracy: RenderBarycentricBlendAccuracy
  ) {
    assert && assert( isFinite( det ) );
    assert && assert( diffA.isFinite() );
    assert && assert( diffB.isFinite() );
    assert && assert( pointC.isFinite() );
  }

  public static from(
    pointA: Vector2,
    pointB: Vector2,
    pointC: Vector2,
    accuracy: RenderBarycentricBlendAccuracy
  ): RenderBarycentricBlendLogic {
    const pA = pointA;
    const pB = pointB;
    const pC = pointC;

    const det = ( pB.y - pC.y ) * ( pA.x - pC.x ) + ( pC.x - pB.x ) * ( pA.y - pC.y );
    const diffA = new Vector2( pB.y - pC.y, pC.x - pB.x );
    const diffB = new Vector2( pC.y - pA.y, pA.x - pC.x );

    /*
    NOTES FOR THE FUTURE: Here were the original formulas
    const det = ( pB.y - pC.y ) * ( pA.x - pC.x ) + ( pC.x - pB.x ) * ( pA.y - pC.y );
    const lambdaA = ( ( pB.y - pC.y ) * ( point.x - pC.x ) + ( pC.x - pB.x ) * ( point.y - pC.y ) ) / det;
    const lambdaB = ( ( pC.y - pA.y ) * ( point.x - pC.x ) + ( pA.x - pC.x ) * ( point.y - pC.y ) ) / det;
     */

    return new RenderBarycentricBlendLogic( det, diffA, diffB, pointC, accuracy );
  }

  public equals( other: RenderBarycentricBlendLogic ): boolean {
    return Math.abs( this.det - other.det ) < 1e-6 &&
           this.diffA.equalsEpsilon( other.diffA, 1e-6 ) &&
           this.diffB.equalsEpsilon( other.diffB, 1e-6 ) &&
           this.pointC.equalsEpsilon( other.pointC, 1e-6 ) &&
           this.accuracy === other.accuracy;
  }

  public apply( output: Vector4, context: RenderEvaluationContext, aColor: Vector4, bColor: Vector4, cColor: Vector4 ): void {
    if ( assert ) {
      if ( this.accuracy === RenderBarycentricBlendAccuracy.Accurate ) {
        assert( context.hasCentroid() );
      }
    }

    const point = this.accuracy === RenderBarycentricBlendAccuracy.Accurate ? context.centroid : context.writeBoundsCentroid( scratchCentroid );
    const pointC = this.pointC;

    const lambdaA = ( this.diffA.x * ( point.x - pointC.x ) + this.diffA.y * ( point.y - pointC.y ) ) / this.det;
    const lambdaB = ( this.diffB.x * ( point.x - pointC.x ) + this.diffB.y * ( point.y - pointC.y ) ) / this.det;
    const lambdaC = 1 - lambdaA - lambdaB;

    output.setXYZW(
      aColor.x * lambdaA + bColor.x * lambdaB + cColor.x * lambdaC,
      aColor.y * lambdaA + bColor.y * lambdaB + cColor.y * lambdaC,
      aColor.z * lambdaA + bColor.z * lambdaB + cColor.z * lambdaC,
      aColor.w * lambdaA + bColor.w * lambdaB + cColor.w * lambdaC
    );
  }
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

  public override toString(): string {
    const det = `det:${this.logic.det}`;
    const diffA = `diffA:${this.logic.diffA.x},${this.logic.diffA.y}`;
    const diffB = `diffB:${this.logic.diffB.x},${this.logic.diffB.y}`;
    const diffC = `pointC:${this.logic.pointC.x},${this.logic.pointC.y}`;
    return `RenderInstructionBarycentricBlend(${det} ${diffA} ${diffB} ${diffC})`;
  }

  public override equals(
    other: RenderInstruction,
    areLocationsEqual: ( a: RenderInstructionLocation, b: RenderInstructionLocation ) => boolean
  ): boolean {
    return other instanceof RenderInstructionBarycentricBlend && this.logic.equals( other.logic );
  }

  public override execute(
    stack: RenderExecutionStack,
    context: RenderEvaluationContext,
    executor: RenderExecutor
  ): void {
    const aColor = stack.popInto( scratchAColor );
    const bColor = stack.popInto( scratchBColor );
    const cColor = stack.popInto( scratchCColor );

    this.logic.apply( scratchResult, context, aColor, bColor, cColor );
    stack.push( scratchResult );
  }

  public override writeBinary( encoder: ByteEncoder, getOffset: ( location: RenderInstructionLocation ) => number ): void {
    encoder.pushU32( RenderInstruction.BarycentricBlendCode | ( this.logic.accuracy << 8 ) ); // 0
    encoder.pushF32( this.logic.det ); // 1
    encoder.pushF32( this.logic.diffA.x ); // 2
    encoder.pushF32( this.logic.diffA.y ); // 3
    encoder.pushF32( this.logic.diffB.x ); // 4
    encoder.pushF32( this.logic.diffB.y ); // 5
    encoder.pushF32( this.logic.pointC.x ); // 6
    encoder.pushF32( this.logic.pointC.y ); // 7
  }

  public static fromBinary(
    encoder: ByteEncoder,
    offset: number,
    getLocation: ( offset: number ) => RenderInstructionLocation
  ): RenderInstructionBarycentricBlend {
    const accuracy: RenderBarycentricBlendAccuracy = ( encoder.fullU32Array[ offset ] >> 8 ) & 0xff;
    const det = encoder.fullF32Array[ offset + 1 ];
    const diffA = new Vector2( encoder.fullF32Array[ offset + 2 ], encoder.fullF32Array[ offset + 3 ] );
    const diffB = new Vector2( encoder.fullF32Array[ offset + 4 ], encoder.fullF32Array[ offset + 5 ] );
    const pointC = new Vector2( encoder.fullF32Array[ offset + 6 ], encoder.fullF32Array[ offset + 7 ] );

    return new RenderInstructionBarycentricBlend( new RenderBarycentricBlendLogic( det, diffA, diffB, pointC, accuracy ) );
  }

  public override getBinaryLength(): number {
    return 8;
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