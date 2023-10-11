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

  public abstract toString(): string;

  public abstract equals( other: RenderInstruction, areLocationsEqual: ( a: RenderInstructionLocation, b: RenderInstructionLocation ) => boolean ): boolean;

  public abstract writeBinary( encoder: ByteEncoder, getOffset: ( location: RenderInstructionLocation ) => number ): void;

  public fromBinary( encoder: ByteEncoder, offset: number, getLocation: ( offset: number ) => RenderInstructionLocation ): void {
    throw new Error( 'unimplemented' );
  }

  /**
   * The number of words (u32s, 4 bytes) that this instruction takes up in the binary stream.
   */
  public abstract getBinaryLength(): number;

  public static instructionsToBinary( encoder: ByteEncoder, instructions: RenderInstruction[] ): void {
    const lengthPrefixSum: number[] = [];

    let sum = 0;
    for ( let i = 0; i < instructions.length; i++ ) {
      lengthPrefixSum.push( sum );
      sum += instructions[ i ].getBinaryLength();
    }

    for ( let i = 0; i < instructions.length; i++ ) {
      instructions[ i ].writeBinary( encoder, location => {
        const locationIndex = instructions.indexOf( location );
        assert && assert( locationIndex >= 0 );

        const offset = lengthPrefixSum[ locationIndex ] - lengthPrefixSum[ i ];
        assert && assert( offset >= 0, 'For now, we have code meant to handle non-negative offsets' );

        return offset;
      } );
    }
  }

  // TODO: better code ordering, prevent duplicates
  // length 1
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
  public static readonly ExitCode = 0x0c;
  public static readonly BlendComposeCode = 0x24;
  public static readonly OpaqueJumpCode = 0x22;
  public static readonly NormalDebugCode = 0x35;


  // length 2
  public static readonly MultiplyScalarCode = 0x21;

  // length 3
  public static readonly PhongCode = 0x34;

  // length 5
  public static readonly PushCode = 0x20;

  // length 7
  public static readonly ComputeLinearBlendRatioCode = 0x30;

  // length 8
  public static readonly BarycentricBlendCode = 0x32;

  // length 11
  public static readonly BarycentricBlendPerspectiveCode = 0x33;

  // length 12
  public static readonly ComputeRadialBlendRatioCode = 0x31;

  // length 21
  public static readonly FilterCode = 0x36;

  // variable length(!)
  public static readonly ComputeLinearGradientRatioCode = 0x37;
  public static readonly ComputeRadialGradientRatioCode = 0x38;

  // TODO
  public static readonly ImageCode = 0x39;
}

const scratchVector = new Vector4( 0, 0, 0, 0 );

let locationID = 0;

export class RenderInstructionLocation extends RenderInstruction {
  public id = locationID++;

  // To be filled in before execution (if in JS)
  public index = 0;

  public override toString(): string {
    return `RenderInstructionLocation(${this.id})`;
  }

  public override equals(
    other: RenderInstruction,
    areLocationsEqual: ( a: RenderInstructionLocation, b: RenderInstructionLocation ) => boolean
  ): boolean {
    return other instanceof RenderInstructionLocation && areLocationsEqual( this, other );
  }

  public override execute(
    stack: RenderExecutionStack,
    context: RenderEvaluationContext,
    executor: RenderExecutor
  ): void {
    // TODO: remove from instruction streams, and add an error here?
  }

  public override writeBinary( encoder: ByteEncoder, getOffset: ( location: RenderInstructionLocation ) => number ): void {
    // no-op, this will be encoded in jump instructions
  }

  public override getBinaryLength(): number {
    return 0;
  }
}

export class RenderInstructionPush extends RenderInstruction {
  public constructor(
    public vector: Vector4
  ) {
    super();
  }

  public override toString(): string {
    const vector = `vector:${this.vector.x},${this.vector.y},${this.vector.z},${this.vector.w}`;
    return `RenderInstructionPush(${vector})`;
  }

  public override equals(
    other: RenderInstruction,
    areLocationsEqual: ( a: RenderInstructionLocation, b: RenderInstructionLocation ) => boolean
  ): boolean {
    return other instanceof RenderInstructionPush && this.vector.equalsEpsilon( other.vector, 1e-6 );
  }

  public override execute(
    stack: RenderExecutionStack,
    context: RenderEvaluationContext,
    executor: RenderExecutor
  ): void {
    stack.push( this.vector );
  }

  public override writeBinary( encoder: ByteEncoder, getOffset: ( location: RenderInstructionLocation ) => number ): void {
    encoder.pushU32( RenderInstruction.PushCode );
    encoder.pushF32( this.vector.x );
    encoder.pushF32( this.vector.y );
    encoder.pushF32( this.vector.z );
    encoder.pushF32( this.vector.w );
  }

  public override getBinaryLength(): number {
    return 5;
  }
}

export class RenderInstructionReturn extends RenderInstruction {

  public override toString(): string {
    return 'RenderInstructionReturn()';
  }

  public override equals(
    other: RenderInstruction,
    areLocationsEqual: ( a: RenderInstructionLocation, b: RenderInstructionLocation ) => boolean
  ): boolean {
    return other instanceof RenderInstructionReturn;
  }

  public override execute(
    stack: RenderExecutionStack,
    context: RenderEvaluationContext,
    executor: RenderExecutor
  ): void {
    executor.return();
  }

  public override writeBinary( encoder: ByteEncoder, getOffset: ( location: RenderInstructionLocation ) => number ): void {
    encoder.pushU32( RenderInstruction.ReturnCode );
  }

  public override getBinaryLength(): number {
    return 1;
  }

  public static readonly INSTANCE = new RenderInstructionReturn();
}

export class RenderInstructionExit extends RenderInstruction {

  public override toString(): string {
    return 'RenderInstructionExit()';
  }

  public override equals(
    other: RenderInstruction,
    areLocationsEqual: ( a: RenderInstructionLocation, b: RenderInstructionLocation ) => boolean
  ): boolean {
    return other instanceof RenderInstructionExit;
  }

  public override execute(
    stack: RenderExecutionStack,
    context: RenderEvaluationContext,
    executor: RenderExecutor
  ): void {
    executor.exit();
  }

  public override writeBinary( encoder: ByteEncoder, getOffset: ( location: RenderInstructionLocation ) => number ): void {
    encoder.pushU32( RenderInstruction.ExitCode );
  }

  public override getBinaryLength(): number {
    return 1;
  }

  public static readonly INSTANCE = new RenderInstructionExit();
}

export class RenderInstructionMultiplyScalar extends RenderInstruction {
  public constructor(
    public factor: number
  ) {
    super();
  }

  public override toString(): string {
    const factor = `factor:${this.factor}`;
    return `RenderInstructionMultiplyScalar(${factor})`;
  }

  public override equals(
    other: RenderInstruction,
    areLocationsEqual: ( a: RenderInstructionLocation, b: RenderInstructionLocation ) => boolean
  ): boolean {
    return other instanceof RenderInstructionMultiplyScalar && Math.abs( this.factor - other.factor ) < 1e-6;
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
    encoder.pushU32( RenderInstruction.MultiplyScalarCode );
    encoder.pushF32( this.factor );
  }

  public override getBinaryLength(): number {
    return 2;
  }
}

alpenglow.register( 'RenderInstruction', RenderInstruction );
