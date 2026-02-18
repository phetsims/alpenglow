// Copyright 2025-2026, University of Colorado Boulder

/**
 * Computes the gradient ratio for a linear or radial gradient
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import { RenderInstruction, RenderInstructionLocation } from './RenderInstruction.js';
import type { RenderLinearGradientLogic } from './RenderLinearGradientLogic.js';
import type { RenderRadialGradientLogic } from './RenderRadialGradientLogic.js';
import type { RenderExecutionStack } from './RenderExecutionStack.js';
import type { RenderEvaluationContext } from './RenderEvaluationContext.js';
import type { RenderExecutor } from './RenderExecutor.js';
import type { ByteEncoder } from '../webgpu/compute/ByteEncoder.js';
import { GRADIENT_BEFORE_RATIO_COUNT_BITS } from './GRADIENT_BEFORE_RATIO_COUNT_BITS.js';

export class RenderInstructionComputeGradientRatio extends RenderInstruction {
  public constructor(
    public readonly logic: RenderLinearGradientLogic | RenderRadialGradientLogic,
    public readonly stopLocations: RenderInstructionLocation[],
    public readonly blendLocation: RenderInstructionLocation
  ) {
    super();
  }

  public override toString(): string {
    const stops = `stops:${this.stopLocations.map( stop => stop.id ).join( ',' )}`;
    const blend = `blend:${this.blendLocation.id}`;
    const ratios = `ratios:${this.logic.ratios.join( ',' )}`;
    if ( this.logic.isLinear() ) {
      const logic = this.logic as RenderLinearGradientLogic;

      const inverseTransform = `inverseTransform:${logic.inverseTransform.m00()},${logic.inverseTransform.m01()},${logic.inverseTransform.m02()},${logic.inverseTransform.m10()},${logic.inverseTransform.m11()},${logic.inverseTransform.m12()}`;
      const start = `start:${logic.start.x},${logic.start.y}`;
      const gradDelta = `gradDelta:${logic.gradDelta.x},${logic.gradDelta.y}`;
      const extend = `extend:${logic.extend}`;
      const accuracy = `accuracy:${logic.accuracy}`;
      return `RenderInstructionComputeGradientRatio(linear, ${inverseTransform} ${start} ${gradDelta} ${extend} ${accuracy} ${ratios} ${stops} ${blend})`;
    }
    else {
      const logic = this.logic as RenderRadialGradientLogic;

      const conicTransform = `conicTransform:${logic.conicTransform.m00()},${logic.conicTransform.m01()},${logic.conicTransform.m02()},${logic.conicTransform.m10()},${logic.conicTransform.m11()},${logic.conicTransform.m12()}`;
      const focalX = `focalX:${logic.focalX}`;
      const radius = `radius:${logic.radius}`;
      const kind = `kind:${logic.kind}`;
      const isSwapped = `isSwapped:${logic.isSwapped}`;
      const accuracy = `accuracy:${logic.accuracy}`;
      return `RenderInstructionComputeGradientRatio(radial, ${conicTransform} ${focalX} ${radius} ${kind} ${isSwapped} ${accuracy} ${ratios} ${stops} ${blend})`;
    }
  }

  public override equals(
    other: RenderInstruction,
    areLocationsEqual: ( a: RenderInstructionLocation, b: RenderInstructionLocation ) => boolean
  ): boolean {
    if ( !( other instanceof RenderInstructionComputeGradientRatio ) ) {
      return false;
    }
    if ( !areLocationsEqual( this.blendLocation, other.blendLocation ) ) {
      return false;
    }
    if ( this.stopLocations.length !== other.stopLocations.length ) {
      return false;
    }
    for ( let i = 0; i < this.stopLocations.length; i++ ) {
      if ( !areLocationsEqual( this.stopLocations[ i ], other.stopLocations[ i ] ) ) {
        return false;
      }
    }

    // TypeScript needs these to be duplicated
    if ( this.logic.isLinear() === other.logic.isLinear() ) {
      // NOTE: identical code, so just using linear for now
      return ( this.logic as RenderLinearGradientLogic ).equals( other.logic as RenderLinearGradientLogic );
    }
    else {
      return false;
    }
  }

  public override execute(
    stack: RenderExecutionStack,
    context: RenderEvaluationContext,
    executor: RenderExecutor
  ): void {
    const t = this.logic.computeLinearValue( context );
    const ratios = this.logic.ratios;

    let i = -1;
    while ( i < ratios.length - 1 && ratios[ i + 1 ] < t ) {
      i++;
    }

    // Queue these up to be in "reverse" order
    executor.jump( this.blendLocation );

    if ( i === -1 ) {
      stack.pushNumber( 0 );
      stack.pushValues( 0, 0, 0, 0 );
      executor.call( this.stopLocations[ 0 ] );
    }
    else if ( i === ratios.length - 1 ) {
      stack.pushNumber( 1 );
      stack.pushValues( 0, 0, 0, 0 );
      executor.call( this.stopLocations[ i ] );
    }
    else {
      const before = ratios[ i ];
      const after = ratios[ i + 1 ];
      const ratio = ( t - before ) / ( after - before );

      stack.pushNumber( ratio );

      const hasBefore = ratio < 1;
      const hasAfter = ratio > 0;

      if ( !hasBefore || !hasAfter ) {
        stack.pushValues( 0, 0, 0, 0 );
      }

      if ( hasBefore ) {
        executor.call( this.stopLocations[ i ] );
      }

      if ( hasAfter ) {
        executor.call( this.stopLocations[ i + 1 ] );
      }
    }
  }

  public override writeBinary( encoder: ByteEncoder, getOffset: ( location: RenderInstructionLocation ) => number ): void {

    const stopOffsets = this.stopLocations.map( getOffset );
    const blendOffset = getOffset( this.blendLocation );
    const ratios = this.logic.ratios;
    const ratioCount = ratios.length;

    if ( this.logic.isLinear() ) {
      const logic = this.logic as RenderLinearGradientLogic;

      encoder.pushU32(
        RenderInstruction.ComputeLinearGradientRatioCode |
        ( logic.accuracy << 8 ) | // 2-bit accuracy
        ( logic.extend << 11 ) | // 2-bit (extended to match radial case)
        ( ratioCount << GRADIENT_BEFORE_RATIO_COUNT_BITS ) // extended to match the radial case
      ); // 0
      assert && assert( ratioCount < 2 ** ( 32 - GRADIENT_BEFORE_RATIO_COUNT_BITS ) );

      encoder.pushF32( logic.inverseTransform.m00() ); // 1
      encoder.pushF32( logic.inverseTransform.m01() ); // 2
      encoder.pushF32( logic.inverseTransform.m02() ); // 3
      encoder.pushF32( logic.inverseTransform.m10() ); // 4
      encoder.pushF32( logic.inverseTransform.m11() ); // 5
      encoder.pushF32( logic.inverseTransform.m12() ); // 6
      encoder.pushF32( logic.start.x ); // 7
      encoder.pushF32( logic.start.y ); // 8
      encoder.pushF32( logic.gradDelta.x ); // 9
      encoder.pushF32( logic.gradDelta.y ); // 10

      encoder.pushU32( blendOffset ); // 11
      for ( let i = 0; i < ratioCount; i++ ) {
        encoder.pushF32( ratios[ i ] ); // 12 + 2 * i
        encoder.pushU32( stopOffsets[ i ] ); // 13 + 2 * i
      }
    }
    else {
      const logic = this.logic as RenderRadialGradientLogic;

      encoder.pushU32(
        RenderInstruction.ComputeRadialGradientRatioCode |
        ( logic.accuracy << 8 ) | // 3-bit accuracy
        ( logic.extend << 11 ) | // 2-bit
        ( logic.kind << 13 ) | // 2-bit
        ( logic.isSwapped ? 1 << 15 : 0 ) | // 1-bit
        ( ratioCount << GRADIENT_BEFORE_RATIO_COUNT_BITS )
      ); // 0
      assert && assert( ratioCount < 2 ** ( 32 - GRADIENT_BEFORE_RATIO_COUNT_BITS ) );

      encoder.pushF32( logic.conicTransform.m00() ); // 1
      encoder.pushF32( logic.conicTransform.m01() ); // 2
      encoder.pushF32( logic.conicTransform.m02() ); // 3
      encoder.pushF32( logic.conicTransform.m10() ); // 4
      encoder.pushF32( logic.conicTransform.m11() ); // 5
      encoder.pushF32( logic.conicTransform.m12() ); // 6
      encoder.pushF32( logic.focalX ); // 7
      encoder.pushF32( logic.radius ); // 8

      encoder.pushU32( blendOffset ); // 9
      for ( let i = 0; i < ratioCount; i++ ) {
        encoder.pushF32( ratios[ i ] ); // 10 + 2 * i
        encoder.pushU32( stopOffsets[ i ] ); // 11 + 2 * i
      }
    }
  }

  public override getBinaryLength(): number {
    if ( this.logic.isLinear() ) {
      return 12 + 2 * this.logic.ratios.length;
    }
    else {
      return 10 + 2 * this.logic.ratios.length;
    }
  }
}