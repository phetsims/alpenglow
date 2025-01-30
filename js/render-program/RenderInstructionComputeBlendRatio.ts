// Copyright 2025, University of Colorado Boulder

/**
 * Computes the blend ratio between two RenderPrograms based on a linear or radial blend.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { RenderInstruction, RenderInstructionLocation } from './RenderInstruction.js';
import type { RenderExecutionStack } from './RenderExecutionStack.js';
import type { RenderEvaluationContext } from './RenderEvaluationContext.js';
import type { RenderExecutor } from './RenderExecutor.js';
import type { ByteEncoder } from '../webgpu/compute/ByteEncoder.js';

import { RenderLinearBlendLogic } from './RenderLinearBlendLogic.js';
import { RenderRadialBlendLogic } from './RenderRadialBlendLogic.js';

export class RenderInstructionComputeBlendRatio extends RenderInstruction {
  public constructor(
    public readonly logic: RenderLinearBlendLogic | RenderRadialBlendLogic,
    public readonly zeroLocation: RenderInstructionLocation,
    public readonly oneLocation: RenderInstructionLocation,
    public readonly blendLocation: RenderInstructionLocation
  ) {
    super();
  }

  public override toString(): string {
    const zero = `zero:${this.zeroLocation.id}`;
    const one = `one:${this.oneLocation.id}`;
    const blend = `blend:${this.blendLocation.id}`;
    if ( this.logic.isLinear() ) {
      const logic = this.logic as RenderLinearBlendLogic;

      const scaledNormal = `scaledNormal:${logic.scaledNormal.x},${logic.scaledNormal.y}`;
      const offset = `offset:${logic.offset}`;
      const accuracy = `accuracy:${logic.accuracy}`;
      return `RenderInstructionComputeBlendRatio(linear, ${scaledNormal} ${offset} ${accuracy} ${zero} ${one} ${blend})`;
    }
    else {
      const logic = this.logic as RenderRadialBlendLogic;

      const inverseTransform = `inverseTransform:${logic.inverseTransform.m00()},${logic.inverseTransform.m01()},${logic.inverseTransform.m02()},${logic.inverseTransform.m10()},${logic.inverseTransform.m11()},${logic.inverseTransform.m12()}`;
      const radius0 = `radius0:${logic.radius0}`;
      const radius1 = `radius1:${logic.radius1}`;
      const accuracy = `accuracy:${logic.accuracy}`;
      return `RenderInstructionComputeBlendRatio(radial, ${inverseTransform} ${radius0} ${radius1} ${accuracy} ${zero} ${one} ${blend})`;
    }
  }

  public override equals(
    other: RenderInstruction,
    areLocationsEqual: ( a: RenderInstructionLocation, b: RenderInstructionLocation ) => boolean
  ): boolean {
    if ( !( other instanceof RenderInstructionComputeBlendRatio ) ) {
      return false;
    }
    if (
      !areLocationsEqual( this.zeroLocation, other.zeroLocation ) ||
      !areLocationsEqual( this.oneLocation, other.oneLocation ) ||
      !areLocationsEqual( this.blendLocation, other.blendLocation )
    ) {
      return false;
    }
    if ( this.logic.isLinear() ) {
      const logic = this.logic as RenderLinearBlendLogic;

      return other.logic.isLinear() &&
             logic.equals( other.logic as RenderLinearBlendLogic );
    }
    else {
      const logic = this.logic as RenderRadialBlendLogic;

      return !other.logic.isLinear() &&
             logic.equals( other.logic as RenderRadialBlendLogic );
    }
  }

  public override execute(
    stack: RenderExecutionStack,
    context: RenderEvaluationContext,
    executor: RenderExecutor
  ): void {
    const t = this.logic.computeLinearValue( context );
    stack.pushNumber( t );

    // Queue these up to be in "reverse" order
    executor.jump( this.blendLocation );

    const hasZero = t < 1;
    const hasOne = t > 0;

    if ( !hasZero || !hasOne ) {
      stack.pushValues( 0, 0, 0, 0 );
    }

    if ( hasZero ) {
      executor.call( this.zeroLocation );
    }

    if ( hasOne ) {
      executor.call( this.oneLocation );
    }
  }

  public override writeBinary( encoder: ByteEncoder, getOffset: ( location: RenderInstructionLocation ) => number ): void {
    const zeroOffset = getOffset( this.zeroLocation );
    const oneOffset = getOffset( this.oneLocation );
    const blendOffset = getOffset( this.blendLocation );

    assert && assert( isFinite( zeroOffset ) && zeroOffset >= 0 );
    assert && assert( isFinite( oneOffset ) && oneOffset >= 0 );
    assert && assert( isFinite( blendOffset ) && blendOffset >= 0 );

    if ( this.logic.isLinear() ) {
      const logic = this.logic as RenderLinearBlendLogic;

      encoder.pushU32(
        RenderInstruction.ComputeLinearBlendRatioCode |
        ( this.logic.accuracy << 8 )
      ); // 0
      encoder.pushU32( zeroOffset ); // 1
      encoder.pushU32( oneOffset ); // 2
      encoder.pushU32( blendOffset ); // 3
      encoder.pushF32( logic.scaledNormal.x ); // 4
      encoder.pushF32( logic.scaledNormal.y ); // 5
      encoder.pushF32( logic.offset ); // 6
    }
    else {
      const logic = this.logic as RenderRadialBlendLogic;

      encoder.pushU32(
        RenderInstruction.ComputeRadialBlendRatioCode |
        ( this.logic.accuracy << 8 )
      ); // 0
      encoder.pushU32( zeroOffset ); // 1
      encoder.pushU32( oneOffset ); // 2
      encoder.pushU32( blendOffset ); // 3
      encoder.pushF32( logic.inverseTransform.m00() ); // 4
      encoder.pushF32( logic.inverseTransform.m01() ); // 5
      encoder.pushF32( logic.inverseTransform.m02() ); // 6
      encoder.pushF32( logic.inverseTransform.m10() ); // 7
      encoder.pushF32( logic.inverseTransform.m11() ); // 8
      encoder.pushF32( logic.inverseTransform.m12() ); // 9
      encoder.pushF32( logic.radius0 ); // 10
      encoder.pushF32( logic.radius1 ); // 11
    }
  }

  public override getBinaryLength(): number {
    if ( this.logic.isLinear() ) {
      return 7;
    }
    else {
      return 12;
    }
  }
}