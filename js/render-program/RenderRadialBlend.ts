// Copyright 2023-2025, University of Colorado Boulder

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

import Matrix3 from '../../../dot/js/Matrix3.js';
import Vector4 from '../../../dot/js/Vector4.js';
import { alpenglow } from '../alpenglow.js';
import { RenderProgram, SerializedRenderProgram } from './RenderProgram.js';
import { RenderEvaluationContext } from './RenderEvaluationContext.js';
import { RenderInstruction, RenderInstructionLocation, RenderInstructionReturn } from './RenderInstruction.js';
import { RenderInstructionLinearBlend } from './RenderLinearBlend.js';
import { RenderColor } from './RenderColor.js';
import { RenderInstructionComputeBlendRatio } from './RenderInstructionComputeBlendRatio.js';
import { RenderRadialBlendLogic } from './RenderRadialBlendLogic.js';
import { RenderRadialBlendAccuracy } from './RenderRadialBlendAccuracy.js';

alpenglow.register( 'RenderRadialBlendAccuracy', RenderRadialBlendAccuracy );

export class RenderRadialBlend extends RenderProgram {

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
      // TODO: Revert this to just Centroid once the we get the WGSL version with integration working!
      accuracy === RenderRadialBlendAccuracy.Centroid || accuracy === RenderRadialBlendAccuracy.Accurate
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
}

alpenglow.register( 'RenderRadialBlend', RenderRadialBlend );

export type SerializedRenderRadialBlend = {
  type: 'RenderRadialBlend';
  transform: number[];
  radius0: number;
  radius1: number;
  accuracy: RenderRadialBlendAccuracy;
  zero: SerializedRenderProgram;
  one: SerializedRenderProgram;
};