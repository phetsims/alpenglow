// Copyright 2023, University of Colorado Boulder

/**
 * RenderProgram for a triangular barycentric blend. Applies perspective correction.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { RenderColor, RenderEvaluationContext, RenderProgram, alpenglow, SerializedRenderProgram, RenderExecutionStack, RenderExecutor, RenderInstruction } from '../imports.js';
import Vector2 from '../../../dot/js/Vector2.js';
import Matrix3 from '../../../dot/js/Matrix3.js';
import Vector4 from '../../../dot/js/Vector4.js';
import Vector3 from '../../../dot/js/Vector3.js';

export enum RenderBarycentricPerspectiveBlendAccuracy {
  // TODO: Accurate should really be the version that runs the perspective correction integral!!!!
  // TODO: do this, the math should work!
  Centroid = 0,
  PixelCenter = 1
}

const scratchCentroid = new Vector2( 0, 0 );

alpenglow.register( 'RenderBarycentricPerspectiveBlendAccuracy', RenderBarycentricPerspectiveBlendAccuracy );

export default class RenderBarycentricPerspectiveBlend extends RenderProgram {

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
    assert && assert( !pointA.toVector2().equals( pointB.toVector2() ) );
    assert && assert( !pointB.toVector2().equals( pointC.toVector2() ) );
    assert && assert( !pointC.toVector2().equals( pointA.toVector2() ) );
    assert && assert( pointA.z > 0 && pointB.z > 0 && pointC.z > 0, 'All points must be in front of the camera' );

    super(
      [ a, b, c ],
      a.isFullyTransparent && b.isFullyTransparent && c.isFullyTransparent,
      a.isFullyOpaque && b.isFullyOpaque && c.isFullyOpaque,
      false,
      false,
      accuracy === RenderBarycentricPerspectiveBlendAccuracy.Centroid
    );

    this.logic = logic || new RenderBarycentricPerspectiveBlendLogic( this.pointA, this.pointB, this.pointC, this.accuracy );
  }

  public override getName(): string {
    return 'RenderBarycentricPerspectiveBlend';
  }

  public override withChildren( children: RenderProgram[] ): RenderBarycentricPerspectiveBlend {
    assert && assert( children.length === 3 );
    return new RenderBarycentricPerspectiveBlend( this.pointA, this.pointB, this.pointC, this.accuracy, children[ 0 ], children[ 1 ], children[ 2 ], this.logic );
  }

  public override transformed( transform: Matrix3 ): RenderProgram {
    const xyA = transform.timesVector2( this.pointA.toVector2() );
    const xyB = transform.timesVector2( this.pointB.toVector2() );
    const xyC = transform.timesVector2( this.pointC.toVector2() );

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

  public static override deserialize( obj: SerializedRenderBarycentricPerspectiveBlend ): RenderBarycentricPerspectiveBlend {
    return new RenderBarycentricPerspectiveBlend(
      new Vector3( obj.pointA[ 0 ], obj.pointA[ 1 ], obj.pointA[ 2 ] ),
      new Vector3( obj.pointB[ 0 ], obj.pointB[ 1 ], obj.pointB[ 2 ] ),
      new Vector3( obj.pointC[ 0 ], obj.pointC[ 1 ], obj.pointC[ 2 ] ),
      obj.accuracy,
      RenderProgram.deserialize( obj.a ),
      RenderProgram.deserialize( obj.b ),
      RenderProgram.deserialize( obj.c )
    );
  }
}

alpenglow.register( 'RenderBarycentricPerspectiveBlend', RenderBarycentricPerspectiveBlend );

export class RenderBarycentricPerspectiveBlendLogic {

  // TODO: potentially on WebGPU, compute the 1/z values early (depending on whether it's worth it to store those)
  // TODO: actually, can we just pack those into the z-spots of the vectors?
  public det: number;
  public diffA: Vector2;
  public diffB: Vector2;

  public constructor(
    public readonly pointA: Vector3,
    public readonly pointB: Vector3,
    public readonly pointC: Vector3,
    public readonly accuracy: RenderBarycentricPerspectiveBlendAccuracy
  ) {
    const pA = pointA;
    const pB = pointB;
    const pC = pointC;

    this.det = ( pB.y - pC.y ) * ( pA.x - pC.x ) + ( pC.x - pB.x ) * ( pA.y - pC.y );
    this.diffA = new Vector2( pB.y - pC.y, pC.x - pB.x );
    this.diffB = new Vector2( pC.y - pA.y, pA.x - pC.x );

    /*
    NOTES FOR THE FUTURE: Here were the original formulas
    const det = ( pB.y - pC.y ) * ( pA.x - pC.x ) + ( pC.x - pB.x ) * ( pA.y - pC.y );
    const lambdaA = ( ( pB.y - pC.y ) * ( point.x - pC.x ) + ( pC.x - pB.x ) * ( point.y - pC.y ) ) / det;
    const lambdaB = ( ( pC.y - pA.y ) * ( point.x - pC.x ) + ( pA.x - pC.x ) * ( point.y - pC.y ) ) / det;
     */
  }

  public apply( output: Vector4, context: RenderEvaluationContext, aColor: Vector4, bColor: Vector4, cColor: Vector4 ): void {

    const point = this.accuracy === RenderBarycentricPerspectiveBlendAccuracy.Centroid ? context.centroid : context.writeBoundsCentroid( scratchCentroid );

    const pointA = this.pointA;
    const pointB = this.pointB;
    const pointC = this.pointC;

    const lambdaA = ( this.diffA.x * ( point.x - pointC.x ) + this.diffA.y * ( point.y - pointC.y ) ) / this.det;
    const lambdaB = ( this.diffB.x * ( point.x - pointC.x ) + this.diffB.y * ( point.y - pointC.y ) ) / this.det;
    const lambdaC = 1 - lambdaA - lambdaB;

    assert && assert( isFinite( lambdaA ), 'Lambda A must be finite' );
    assert && assert( isFinite( lambdaB ), 'Lambda B must be finite' );
    assert && assert( isFinite( lambdaC ), 'Lambda C must be finite' );

    assert && assert( pointA.z !== 0 );
    assert && assert( pointB.z !== 0 );
    assert && assert( pointC.z !== 0 );

    const z = 1 / ( lambdaA / pointA.z + lambdaB / pointB.z + lambdaC / pointC.z );

    assert && assert( aColor.isFinite(), `Color A must be finite: ${aColor}` );
    assert && assert( bColor.isFinite(), `Color B must be finite: ${bColor}` );
    assert && assert( cColor.isFinite(), `Color C must be finite: ${cColor}` );
    assert && assert( z > 0, 'z must be positive' );

    output.setXYZW(
      z * ( aColor.x * lambdaA / pointA.z + bColor.x * lambdaB / pointB.z + cColor.x * lambdaC / pointC.z ),
      z * ( aColor.y * lambdaA / pointA.z + bColor.y * lambdaB / pointB.z + cColor.y * lambdaC / pointC.z ),
      z * ( aColor.z * lambdaA / pointA.z + bColor.z * lambdaB / pointB.z + cColor.z * lambdaC / pointC.z ),
      z * ( aColor.w * lambdaA / pointA.z + bColor.w * lambdaB / pointB.z + cColor.w * lambdaC / pointC.z )
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
