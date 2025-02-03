// Copyright 2023-2025, University of Colorado Boulder

/**
 * RenderProgram for a triangular barycentric blend. Applies perspective correction.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import Matrix3 from '../../../dot/js/Matrix3.js';
import Vector2 from '../../../dot/js/Vector2.js';
import Vector3 from '../../../dot/js/Vector3.js';
import Vector4 from '../../../dot/js/Vector4.js';
import { alpenglow } from '../alpenglow.js';
import type { ByteEncoder } from '../webgpu/compute/ByteEncoder.js';
import { RenderColor } from './RenderColor.js';
import type { RenderEvaluationContext } from './RenderEvaluationContext.js';
import type { RenderExecutionStack } from './RenderExecutionStack.js';
import type { RenderExecutor } from './RenderExecutor.js';
import { RenderInstruction, RenderInstructionLocation } from './RenderInstruction.js';
import { RenderProgram, SerializedRenderProgram } from './RenderProgram.js';

export enum RenderBarycentricPerspectiveBlendAccuracy {
  // TODO: Accurate should really be the version that runs the perspective correction integral!!!!
  // TODO: do this, the math should work!
  Centroid = 0,
  PixelCenter = 1
}

const scratchCentroid = new Vector2( 0, 0 );

alpenglow.register( 'RenderBarycentricPerspectiveBlendAccuracy', RenderBarycentricPerspectiveBlendAccuracy );

export class RenderBarycentricPerspectiveBlend extends RenderProgram {

  public readonly logic: RenderBarycentricPerspectiveBlendLogic;

  public constructor(
    public readonly pointA: Vector3,
    public readonly pointB: Vector3,
    public readonly pointC: Vector3,
    public readonly accuracy: RenderBarycentricPerspectiveBlendAccuracy,
    public readonly a: RenderProgram,
    public readonly b: RenderProgram,
    public readonly c: RenderProgram,
    logic?: RenderBarycentricPerspectiveBlendLogic
  ) {
    assert && assert( pointA.isFinite() );
    assert && assert( pointB.isFinite() );
    assert && assert( pointC.isFinite() );
    assert && assert( !Vector2.from( pointA ).equals( Vector2.from( pointB ) ) );
    assert && assert( !Vector2.from( pointB ).equals( Vector2.from( pointC ) ) );
    assert && assert( !Vector2.from( pointC ).equals( Vector2.from( pointA ) ) );
    assert && assert( pointA.z > 0 && pointB.z > 0 && pointC.z > 0, 'All points must be in front of the camera' );

    super(
      [ a, b, c ],
      a.isFullyTransparent && b.isFullyTransparent && c.isFullyTransparent,
      a.isFullyOpaque && b.isFullyOpaque && c.isFullyOpaque,
      false,
      false,
      accuracy === RenderBarycentricPerspectiveBlendAccuracy.Centroid
    );

    this.logic = logic || RenderBarycentricPerspectiveBlendLogic.from( this.pointA, this.pointB, this.pointC, this.accuracy );
  }

  public override getName(): string {
    return 'RenderBarycentricPerspectiveBlend';
  }

  public override withChildren( children: RenderProgram[] ): RenderBarycentricPerspectiveBlend {
    assert && assert( children.length === 3 );
    return new RenderBarycentricPerspectiveBlend( this.pointA, this.pointB, this.pointC, this.accuracy, children[ 0 ], children[ 1 ], children[ 2 ], this.logic );
  }

  public override transformed( transform: Matrix3 ): RenderProgram {
    const xyA = transform.timesVector2( Vector2.from( this.pointA ) );
    const xyB = transform.timesVector2( Vector2.from( this.pointB ) );
    const xyC = transform.timesVector2( Vector2.from( this.pointC ) );

    return new RenderBarycentricPerspectiveBlend(
      new Vector3( xyA.x, xyA.y, this.pointA.z ),
      new Vector3( xyB.x, xyB.y, this.pointB.z ),
      new Vector3( xyC.x, xyC.y, this.pointC.z ),
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

  // TODO: extract code for the barycentric blends? duplicated
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
    instructions.push( new RenderInstructionBarycentricPerspectiveBlend( this.logic ) );
  }

  public override serialize(): SerializedRenderBarycentricPerspectiveBlend {
    return {
      type: 'RenderBarycentricPerspectiveBlend',
      pointA: [ this.pointA.x, this.pointA.y, this.pointA.z ],
      pointB: [ this.pointB.x, this.pointB.y, this.pointB.z ],
      pointC: [ this.pointC.x, this.pointC.y, this.pointC.z ],
      accuracy: this.accuracy,
      a: this.a.serialize(),
      b: this.b.serialize(),
      c: this.c.serialize()
    };
  }
}

alpenglow.register( 'RenderBarycentricPerspectiveBlend', RenderBarycentricPerspectiveBlend );

export class RenderBarycentricPerspectiveBlendLogic {

  public constructor(
    public readonly det: number,
    public readonly diffA: Vector2,
    public readonly diffB: Vector2,
    public readonly point2C: Vector2,
    public readonly zInverseA: number,
    public readonly zInverseB: number,
    public readonly zInverseC: number,
    public readonly accuracy: RenderBarycentricPerspectiveBlendAccuracy
  ) {

  }

  public static from(
    pointA: Vector3,
    pointB: Vector3,
    pointC: Vector3,
    accuracy: RenderBarycentricPerspectiveBlendAccuracy
  ): RenderBarycentricPerspectiveBlendLogic {
    const pA = pointA;
    const pB = pointB;
    const pC = pointC;

    assert && assert( pointA.z !== 0 );
    assert && assert( pointB.z !== 0 );
    assert && assert( pointC.z !== 0 );

    const det = ( pB.y - pC.y ) * ( pA.x - pC.x ) + ( pC.x - pB.x ) * ( pA.y - pC.y );
    const diffA = new Vector2( pB.y - pC.y, pC.x - pB.x );
    const diffB = new Vector2( pC.y - pA.y, pA.x - pC.x );
    const point2C = Vector2.from( pC );
    const zInverseA = 1 / pA.z;
    const zInverseB = 1 / pB.z;
    const zInverseC = 1 / pC.z;

    /*
    NOTES FOR THE FUTURE: Here were the original formulas
    const det = ( pB.y - pC.y ) * ( pA.x - pC.x ) + ( pC.x - pB.x ) * ( pA.y - pC.y );
    const lambdaA = ( ( pB.y - pC.y ) * ( point.x - pC.x ) + ( pC.x - pB.x ) * ( point.y - pC.y ) ) / det;
    const lambdaB = ( ( pC.y - pA.y ) * ( point.x - pC.x ) + ( pA.x - pC.x ) * ( point.y - pC.y ) ) / det;
     */

    return new RenderBarycentricPerspectiveBlendLogic( det, diffA, diffB, point2C, zInverseA, zInverseB, zInverseC, accuracy );
  }

  public equals( other: RenderBarycentricPerspectiveBlendLogic ): boolean {
    return Math.abs( this.det - other.det ) < 1e-6 &&
           this.diffA.equalsEpsilon( other.diffA, 1e-6 ) &&
           this.diffB.equalsEpsilon( other.diffB, 1e-6 ) &&
           this.point2C.equalsEpsilon( other.point2C, 1e-6 ) &&
           Math.abs( this.zInverseA - other.zInverseA ) < 1e-6 &&
           Math.abs( this.zInverseB - other.zInverseB ) < 1e-6 &&
           Math.abs( this.zInverseC - other.zInverseC ) < 1e-6 &&
           this.accuracy === other.accuracy;
  }

  public apply( output: Vector4, context: RenderEvaluationContext, aColor: Vector4, bColor: Vector4, cColor: Vector4 ): void {

    const point = this.accuracy === RenderBarycentricPerspectiveBlendAccuracy.Centroid ? context.centroid : context.writeBoundsCentroid( scratchCentroid );

    const lambdaA = ( this.diffA.x * ( point.x - this.point2C.x ) + this.diffA.y * ( point.y - this.point2C.y ) ) / this.det;
    const lambdaB = ( this.diffB.x * ( point.x - this.point2C.x ) + this.diffB.y * ( point.y - this.point2C.y ) ) / this.det;
    const lambdaC = 1 - lambdaA - lambdaB;

    assert && assert( isFinite( lambdaA ), 'Lambda A must be finite' );
    assert && assert( isFinite( lambdaB ), 'Lambda B must be finite' );
    assert && assert( isFinite( lambdaC ), 'Lambda C must be finite' );

    assert && assert( isFinite( this.zInverseA ) );
    assert && assert( isFinite( this.zInverseB ) );
    assert && assert( isFinite( this.zInverseC ) );

    const z = 1 / ( lambdaA * this.zInverseA + lambdaB * this.zInverseB + lambdaC * this.zInverseC );

    assert && assert( aColor.isFinite(), `Color A must be finite: ${aColor}` );
    assert && assert( bColor.isFinite(), `Color B must be finite: ${bColor}` );
    assert && assert( cColor.isFinite(), `Color C must be finite: ${cColor}` );
    assert && assert( z > 0, 'z must be positive' );

    const aFactor = z * lambdaA * this.zInverseA;
    const bFactor = z * lambdaB * this.zInverseB;
    const cFactor = z * lambdaC * this.zInverseC;

    output.setXYZW(
      aColor.x * aFactor + bColor.x * bFactor + cColor.x * cFactor,
      aColor.y * aFactor + bColor.y * bFactor + cColor.y * cFactor,
      aColor.z * aFactor + bColor.z * bFactor + cColor.z * cFactor,
      aColor.w * aFactor + bColor.w * bFactor + cColor.w * cFactor
    );
  }
}

const scratchAColor = new Vector4( 0, 0, 0, 0 );
const scratchBColor = new Vector4( 0, 0, 0, 0 );
const scratchCColor = new Vector4( 0, 0, 0, 0 );
const scratchResult = new Vector4( 0, 0, 0, 0 );

export class RenderInstructionBarycentricPerspectiveBlend extends RenderInstruction {
  public constructor(
    public readonly logic: RenderBarycentricPerspectiveBlendLogic
  ) {
    super();
  }

  public override toString(): string {
    const det = `det:${this.logic.det}`;
    const diffA = `diffA:${this.logic.diffA.x},${this.logic.diffA.y}`;
    const diffB = `diffB:${this.logic.diffB.x},${this.logic.diffB.y}`;
    const pointC = `pointC:${this.logic.point2C.x},${this.logic.point2C.y}`;
    const zValues = `zInverses:${this.logic.zInverseA},${this.logic.zInverseB},${this.logic.zInverseC}`;
    return `RenderInstructionBarycentricPerspectiveBlend(${det} ${diffA} ${diffB} ${pointC} ${zValues})`;
  }

  public override equals(
    other: RenderInstruction,
    areLocationsEqual: ( a: RenderInstructionLocation, b: RenderInstructionLocation ) => boolean
  ): boolean {
    return other instanceof RenderInstructionBarycentricPerspectiveBlend && this.logic.equals( other.logic );
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
    encoder.pushU32( RenderInstruction.BarycentricPerspectiveBlendCode | ( this.logic.accuracy << 8 ) ); // 0
    encoder.pushF32( this.logic.det ); // 1
    encoder.pushF32( this.logic.diffA.x ); // 2
    encoder.pushF32( this.logic.diffA.y ); // 3
    encoder.pushF32( this.logic.diffB.x ); // 4
    encoder.pushF32( this.logic.diffB.y ); // 5
    encoder.pushF32( this.logic.point2C.x ); // 6
    encoder.pushF32( this.logic.point2C.y ); // 7
    encoder.pushF32( this.logic.zInverseA ); // 8
    encoder.pushF32( this.logic.zInverseB ); // 9
    encoder.pushF32( this.logic.zInverseC ); // 10
  }

  public static fromBinary(
    encoder: ByteEncoder,
    offset: number,
    getLocation: ( offset: number ) => RenderInstructionLocation
  ): RenderInstructionBarycentricPerspectiveBlend {
    const accuracy: RenderBarycentricPerspectiveBlendAccuracy = ( encoder.fullU32Array[ offset ] >> 8 ) & 0xff;
    const det = encoder.fullF32Array[ offset + 1 ];
    const diffA = new Vector2( encoder.fullF32Array[ offset + 2 ], encoder.fullF32Array[ offset + 3 ] );
    const diffB = new Vector2( encoder.fullF32Array[ offset + 4 ], encoder.fullF32Array[ offset + 5 ] );
    const point2C = new Vector2( encoder.fullF32Array[ offset + 6 ], encoder.fullF32Array[ offset + 7 ] );
    const zInverseA = encoder.fullF32Array[ offset + 8 ];
    const zInverseB = encoder.fullF32Array[ offset + 9 ];
    const zInverseC = encoder.fullF32Array[ offset + 10 ];

    return new RenderInstructionBarycentricPerspectiveBlend( new RenderBarycentricPerspectiveBlendLogic( det, diffA, diffB, point2C, zInverseA, zInverseB, zInverseC, accuracy ) );
  }

  public override getBinaryLength(): number {
    return 11;
  }
}

export type SerializedRenderBarycentricPerspectiveBlend = {
  type: 'RenderBarycentricPerspectiveBlend';
  pointA: number[];
  pointB: number[];
  pointC: number[];
  accuracy: RenderBarycentricPerspectiveBlendAccuracy;
  a: SerializedRenderProgram;
  b: SerializedRenderProgram;
  c: SerializedRenderProgram;
};