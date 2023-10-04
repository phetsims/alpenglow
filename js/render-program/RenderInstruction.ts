// Copyright 2023, University of Colorado Boulder

/**
 * Represents an instruction to execute part of a RenderProgram based on an execution stack
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { RenderEvaluationContext, RenderExecutor, alpenglow, ByteEncoder } from '../imports.js';
import RenderExecutionStack from './RenderExecutionStack.js';
import Vector4 from '../../../dot/js/Vector4.js';

export default abstract class RenderInstruction {
  public abstract execute(
    stack: RenderExecutionStack,
    context: RenderEvaluationContext,
    executor: RenderExecutor
  ): void;

  public writeBinary( encoder: ByteEncoder, getOffset: ( location: RenderInstructionLocation ) => number ): void {
    throw new Error( 'unimplemented' );
  }

  // TODO: should we group so we can read out bytes used quickly?

  // TODO: actually, we can dynamically generate the instruction codes based on "WHAT WE WANT TO SUPPORT"
  // TODO: so... we probably don't need to be too stingy?

  // 0 extra bytes
  public static readonly ReturnCode = 0x00;
  public static readonly PremultiplyCode = 0x01;
  public static readonly UnpremultiplyCode = 0x02;
  public static readonly StackBlendCode = 0x03;
  public static readonly LinearBlendCode = 0x04;
  public static readonly LinearDisplayP3ToLinearSRGBCode = 0x05;
  public static readonly LinearSRGBToLinearDisplayP3Code = 0x06;
  public static readonly LinearSRGBToOklabCode = 0x07;
  public static readonly LinearSRGBToSRGBCode = 0x08;
  public static readonly OklabToLinearSRGBCode = 0x09;
  public static readonly SRGBToLinearSRGBCode = 0x0a;
  public static readonly NormalizeCode = 0x0b;

  // 1 extra byte (u8)
  public static readonly OpaqueShortJumpCode = 0x22;
  public static readonly BlendComposeCode = 0x24; // 3 bits compose, 4 bits blend

  // 2 extra bytes (u16)
  public static readonly OpaqueLongJumpCode = 0x23;

  // 4 extra bytes
  public static readonly MultiplyScalarCode = 0x21; // f32 x1

  // 16 extra bytes
  public static readonly PushCode = 0x20; // f32 x4

  // 19 extra bytes
  public static readonly ComputeLinearBlendRatioCode = 0x30; // u16 x3 locations, f32 x2 scaled normal, f32 x1 offset, u8 x1 accuracy

  // 39 extra bytes
  public static readonly ComputeRadialBlendRatioCode = 0x31; // u16 x3 locations, f32 x6 affine inverse, f32 x2 radii, u8 x1 accuracy

  // 29 extra bytes
  public static readonly BarycentricBlendCode = 0x32; // f32 x1 det, f32 x6 (3 points), u8 x1 accuracy

  // public static readonly BarycentricBlendPerspectiveCode = 0x33;

  // BarycentricBlendPerspective TODO
  // Filter TODO
  // Image TODO
  // ComputeLinearGradientRatio TODO
  // ComputeRadialGradientRatio TODO
  // NormalDebug TODO
  // Phong TODO
}

const scratchVector = new Vector4( 0, 0, 0, 0 );

let locationID = 0;

export class RenderInstructionLocation extends RenderInstruction {
  public id = locationID++;

  // To be filled in before execution (if in JS)
  public index = 0;

  public override execute(
    stack: RenderExecutionStack,
    context: RenderEvaluationContext,
    executor: RenderExecutor
  ): void {
    // TODO: remove from instruction streams, and add an error here?
  }
}

export class RenderInstructionPush extends RenderInstruction {
  public constructor(
    public vector: Vector4
  ) {
    super();
  }

  public override execute(
    stack: RenderExecutionStack,
    context: RenderEvaluationContext,
    executor: RenderExecutor
  ): void {
    stack.push( this.vector );
  }

  public override writeBinary( encoder: ByteEncoder, getOffset: ( location: RenderInstructionLocation ) => number ): void {
    encoder.pushU8( RenderInstruction.PushCode );
    encoder.pushF32( this.vector.x );
    encoder.pushF32( this.vector.y );
    encoder.pushF32( this.vector.z );
    encoder.pushF32( this.vector.w );
  }
}

export class RenderInstructionReturn extends RenderInstruction {
  public override execute(
    stack: RenderExecutionStack,
    context: RenderEvaluationContext,
    executor: RenderExecutor
  ): void {
    executor.return();
  }

  public override writeBinary( encoder: ByteEncoder, getOffset: ( location: RenderInstructionLocation ) => number ): void {
    encoder.pushU8( RenderInstruction.ReturnCode );
  }

  public static readonly INSTANCE = new RenderInstructionReturn();
}

export class RenderInstructionMultiplyScalar extends RenderInstruction {
  public constructor(
    public factor: number
  ) {
    super();
  }

  public execute(
    stack: RenderExecutionStack,
    context: RenderEvaluationContext,
    executor: RenderExecutor
  ): void {
    stack.readTop( scratchVector );
    scratchVector.multiplyScalar( this.factor );
    stack.writeTop( scratchVector );
  }

  public override writeBinary( encoder: ByteEncoder, getOffset: ( location: RenderInstructionLocation ) => number ): void {
    encoder.pushU8( RenderInstruction.MultiplyScalarCode );
    encoder.pushF32( this.factor );
  }
}

alpenglow.register( 'RenderInstruction', RenderInstruction );
