// Copyright 2023, University of Colorado Boulder

/**
 * RenderProgram for a radial blend (essentially a chunk of a radial gradient with only a linear transition between
 * two things.
 *
 * RenderRadialBlend will interpolate between two different RenderPrograms based on the location. It will evaluate
 * `clamp( ( averageFragmentRadius - radius0 ) / ( radius1 - radius0 ), 0, 1 )`, and will linearly blend
 * between the "zero" program (when the value is 0) and the "one" program (when the value is 1).
 *
 * It can be used in a standalone way, however it is primarily meant to be used when a `RenderRadialGradient`
 * is circular, and is split into each radial-linear partition.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, LinearEdge, RenderColor, RenderEvaluationContext, RenderInstruction, RenderInstructionComputeBlendRatio, RenderInstructionLinearBlend, RenderInstructionLocation, RenderInstructionReturn, RenderProgram, SerializedRenderProgram } from '../imports.js';
import Vector2 from '../../../dot/js/Vector2.js';
import Matrix3 from '../../../dot/js/Matrix3.js';
import Vector4 from '../../../dot/js/Vector4.js';

const scratchRadialBlendVector = new Vector2( 0, 0 );

const scratchVectorA = new Vector2( 0, 0 );
const scratchVectorB = new Vector2( 0, 0 );
const scratchVectorC = new Vector2( 0, 0 );
const scratchVectorD = new Vector2( 0, 0 );

export enum RenderRadialBlendAccuracy {
  Accurate = 0,
  Centroid = 1,
  PixelCenter = 2
}

alpenglow.register( 'RenderRadialBlendAccuracy', RenderRadialBlendAccuracy );

export default class RenderRadialBlend extends RenderProgram {

  public readonly logic: RenderRadialBlendLogic;

  public constructor(
    public readonly transform: Matrix3,
    public readonly radius0: number,
    public readonly radius1: number,
    public readonly accuracy: RenderRadialBlendAccuracy,
    public readonly zero: RenderProgram,
    public readonly one: RenderProgram,
    logic?: RenderRadialBlendLogic
  ) {
    assert && assert( transform.isFinite() );
    assert && assert( isFinite( radius0 ) && radius0 >= 0 );
    assert && assert( isFinite( radius1 ) && radius1 >= 0 );
    assert && assert( radius0 !== radius1 );

    super(
      [ zero, one ],
      zero.isFullyTransparent && one.isFullyTransparent,
      zero.isFullyOpaque && one.isFullyOpaque,
      accuracy === RenderRadialBlendAccuracy.Accurate,
      accuracy === RenderRadialBlendAccuracy.Accurate,
      accuracy === RenderRadialBlendAccuracy.Centroid
    );

    this.logic = logic || new RenderRadialBlendLogic( this.transform, this.radius0, this.radius1, this.accuracy );
  }

  public override getName(): string {
    return 'RenderRadialBlend';
  }

  public override withChildren( children: RenderProgram[] ): RenderRadialBlend {
    assert && assert( children.length === 2 );
    return new RenderRadialBlend( this.transform, this.radius0, this.radius1, this.accuracy, children[ 0 ], children[ 1 ], this.logic );
  }

  public override transformed( transform: Matrix3 ): RenderProgram {
    return new RenderRadialBlend(
      transform.timesMatrix( this.transform ),
      this.radius0,
      this.radius1,
      this.accuracy,
      this.zero.transformed( transform ),
      this.one.transformed( transform )
    );
  }

  protected override equalsTyped( other: this ): boolean {
    return this.transform.equals( other.transform ) &&
           this.radius0 === other.radius0 &&
           this.radius1 === other.radius1 &&
           this.accuracy === other.accuracy;
  }

  protected override getSimplified( children: RenderProgram[] ): RenderProgram | null {
    const zero = children[ 0 ];
    const one = children[ 1 ];

    if ( zero.isFullyTransparent && one.isFullyTransparent ) {
      return RenderColor.TRANSPARENT;
    }
    else if ( zero.equals( one ) ) {
      return zero;
    }
    else {
      return null;
    }
  }

  public override evaluate( context: RenderEvaluationContext ): Vector4 {
    const t = this.logic.computeLinearValue( context );

    if ( t <= 0 ) {
      return this.zero.evaluate( context );
    }
    else if ( t >= 1 ) {
      return this.one.evaluate( context );
    }
    else {
      return RenderColor.ratioBlend(
        this.zero.evaluate( context ),
        this.one.evaluate( context ),
        t
      );
    }
  }

  public override writeInstructions( instructions: RenderInstruction[] ): void {
    const zeroLocation = new RenderInstructionLocation();
    const oneLocation = new RenderInstructionLocation();
    const blendLocation = new RenderInstructionLocation();

    instructions.push( new RenderInstructionComputeBlendRatio( this.logic, zeroLocation, oneLocation, blendLocation ) );
    instructions.push( zeroLocation );
    this.zero.writeInstructions( instructions );
    instructions.push( RenderInstructionReturn.INSTANCE );
    instructions.push( oneLocation );
    this.one.writeInstructions( instructions );
    instructions.push( RenderInstructionReturn.INSTANCE );
    instructions.push( blendLocation );
    instructions.push( RenderInstructionLinearBlend.INSTANCE );
  }

  public override serialize(): SerializedRenderRadialBlend {
    return {
      type: 'RenderRadialBlend',
      transform: [
        this.transform.m00(), this.transform.m01(), this.transform.m02(),
        this.transform.m10(), this.transform.m11(), this.transform.m12(),
        this.transform.m20(), this.transform.m21(), this.transform.m22()
      ],
      radius0: this.radius0,
      radius1: this.radius1,
      accuracy: this.accuracy,
      zero: this.zero.serialize(),
      one: this.one.serialize()
    };
  }

  public static override deserialize( obj: SerializedRenderRadialBlend ): RenderRadialBlend {
    return new RenderRadialBlend(
      Matrix3.rowMajor(
        obj.transform[ 0 ], obj.transform[ 1 ], obj.transform[ 2 ],
        obj.transform[ 3 ], obj.transform[ 4 ], obj.transform[ 5 ],
        obj.transform[ 6 ], obj.transform[ 7 ], obj.transform[ 8 ]
      ),
      obj.radius0,
      obj.radius1,
      obj.accuracy,
      RenderProgram.deserialize( obj.zero ),
      RenderProgram.deserialize( obj.one )
    );
  }
}

alpenglow.register( 'RenderRadialBlend', RenderRadialBlend );

export class RenderRadialBlendLogic {

  public readonly inverseTransform: Matrix3;

  public constructor(
    public readonly transform: Matrix3,
    public readonly radius0: number,
    public readonly radius1: number,
    public readonly accuracy: RenderRadialBlendAccuracy
  ) {
    this.inverseTransform = transform.inverted();
  }

  public computeLinearValue(
    context: RenderEvaluationContext
  ): number {
    // TODO: flag to control whether this gets set? TODO: Flag to just use centroid
    let averageDistance;
    if ( this.accuracy === RenderRadialBlendAccuracy.Accurate ) {
      assert && assert( context.hasArea() );

      if ( context.face ) {
        averageDistance = context.face.getAverageDistanceTransformedToOrigin( this.inverseTransform, context.area );
      }
      else {
        // NOTE: Do the equivalent of the above, but without creating a face and a ton of garbage

        const p0 = this.inverseTransform.multiplyVector2( scratchVectorA.setXY( context.minX, context.minY ) );
        const p1 = this.inverseTransform.multiplyVector2( scratchVectorB.setXY( context.maxX, context.minY ) );
        const p2 = this.inverseTransform.multiplyVector2( scratchVectorC.setXY( context.maxX, context.maxY ) );
        const p3 = this.inverseTransform.multiplyVector2( scratchVectorD.setXY( context.minX, context.maxY ) );

        // Needs CCW orientation
        averageDistance = (
                            LinearEdge.evaluateLineIntegralDistance( p0.x, p0.y, p1.x, p1.y ) +
                            LinearEdge.evaluateLineIntegralDistance( p1.x, p1.y, p2.x, p2.y ) +
                            LinearEdge.evaluateLineIntegralDistance( p2.x, p2.y, p3.x, p3.y ) +
                            LinearEdge.evaluateLineIntegralDistance( p3.x, p3.y, p0.x, p0.y )
                          ) / ( context.area * this.inverseTransform.getSignedScale() );

        assert && assert( averageDistance === context.getFace().getAverageDistanceTransformedToOrigin( this.inverseTransform, context.area ) );
      }
    }
    else if ( this.accuracy === RenderRadialBlendAccuracy.Centroid ) {
      assert && assert( context.hasCentroid() );

      const localPoint = scratchRadialBlendVector.set( context.centroid );
      this.inverseTransform.multiplyVector2( localPoint );

      averageDistance = localPoint.magnitude;
    }
    else if ( this.accuracy === RenderRadialBlendAccuracy.PixelCenter ) {
      const localPoint = context.writeBoundsCentroid( scratchRadialBlendVector );
      this.inverseTransform.multiplyVector2( localPoint );

      averageDistance = localPoint.magnitude;
    }
    else {
      throw new Error( 'unreachable' );
    }
    assert && assert( isFinite( averageDistance ) );

    // if ( assert ) {
    //
    //   const maxDistance = Math.sqrt( ( maxX - minX ) ** 2 + ( maxY - minY ) ** 2 );
    //   assert( Math.abs( averageDistance - localPoint.magnitude ) < maxDistance * 5 );
    // }

    // TODO: assuming no actual order, BUT needs positive radii?
    const t = ( averageDistance - this.radius0 ) / ( this.radius1 - this.radius0 );
    assert && assert( isFinite( t ) );

    return t;
  }
}

export type SerializedRenderRadialBlend = {
  type: 'RenderRadialBlend';
  transform: number[];
  radius0: number;
  radius1: number;
  accuracy: RenderRadialBlendAccuracy;
  zero: SerializedRenderProgram;
  one: SerializedRenderProgram;
};
