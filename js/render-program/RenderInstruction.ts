// Copyright 2023, University of Colorado Boulder

/**
 * Represents an instruction to execute part of a RenderProgram based on an execution stack
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, ByteEncoder, RenderEvaluationContext, RenderExecutionStack, RenderExecutor, RenderInstructionBarycentricBlend, RenderInstructionBarycentricPerspectiveBlend, RenderInstructionBlendCompose, RenderInstructionComputeBlendRatio, RenderInstructionComputeGradientRatio, RenderInstructionFilter, RenderInstructionLinearBlend, RenderInstructionLinearDisplayP3ToLinearSRGB, RenderInstructionLinearSRGBToLinearDisplayP3, RenderInstructionLinearSRGBToOklab, RenderInstructionLinearSRGBToSRGB, RenderInstructionNormalDebug, RenderInstructionNormalize, RenderInstructionOklabToLinearSRGB, RenderInstructionOpaqueJump, RenderInstructionPhong, RenderInstructionPremultiply, RenderInstructionSRGBToLinearSRGB, RenderInstructionStackBlend, RenderInstructionUnpremultiply } from '../imports.js';
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

  /**
   * The number of words (u32s, 4 bytes) that this instruction takes up in the binary stream.
   */
  public abstract getBinaryLength(): number;

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
  public static readonly BarycentricPerspectiveBlendCode = 0x33;

  // length 12
  public static readonly ComputeRadialBlendRatioCode = 0x31;

  // length 21
  public static readonly FilterCode = 0x36;

  // variable length(!)
  public static readonly ComputeLinearGradientRatioCode = 0x37;
  public static readonly ComputeRadialGradientRatioCode = 0x38;

  // TODO
  public static readonly ImageCode = 0x39;

  public static getInstructionLength( word: number ): number {
    const code = word & 0xff;

    switch( code ) {
      case RenderInstruction.ReturnCode:
      case RenderInstruction.PremultiplyCode:
      case RenderInstruction.UnpremultiplyCode:
      case RenderInstruction.StackBlendCode:
      case RenderInstruction.LinearBlendCode:
      case RenderInstruction.LinearDisplayP3ToLinearSRGBCode:
      case RenderInstruction.LinearSRGBToLinearDisplayP3Code:
      case RenderInstruction.LinearSRGBToOklabCode:
      case RenderInstruction.LinearSRGBToSRGBCode:
      case RenderInstruction.OklabToLinearSRGBCode:
      case RenderInstruction.SRGBToLinearSRGBCode:
      case RenderInstruction.NormalizeCode:
      case RenderInstruction.ExitCode:
      case RenderInstruction.BlendComposeCode:
      case RenderInstruction.OpaqueJumpCode:
      case RenderInstruction.NormalDebugCode:
        return 1;

      case RenderInstruction.MultiplyScalarCode:
        return 2;

      case RenderInstruction.PhongCode:
        return 3;

      case RenderInstruction.PushCode:
        return 5;

      case RenderInstruction.ComputeLinearBlendRatioCode:
        return 7;

      case RenderInstruction.BarycentricBlendCode:
        return 8;

      case RenderInstruction.BarycentricPerspectiveBlendCode:
        return 11;

      case RenderInstruction.ComputeRadialBlendRatioCode:
        return 12;

      case RenderInstruction.FilterCode:
        return 21;

      case RenderInstruction.ComputeLinearGradientRatioCode:
        return 12 + 2 * ( word >> RenderInstructionComputeGradientRatio.GRADIENT_BEFORE_RATIO_COUNT_BITS );
      case RenderInstruction.ComputeRadialGradientRatioCode:
        return 10 + 2 * ( word >> RenderInstructionComputeGradientRatio.GRADIENT_BEFORE_RATIO_COUNT_BITS );

      default:
        throw new Error( `Unknown/unimplemented instruction code: ${code}` );
    }
  }

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

    encoder.pushU32( RenderInstruction.ExitCode );
  }

  public static binaryToInstructions( encoder: ByteEncoder, offset: number ): RenderInstruction[] {
    const instructionAddresses: number[] = [];

    let address = offset;
    while ( encoder.fullU32Array[ address ] !== RenderInstruction.ExitCode ) {
      instructionAddresses.push( address );
      address += RenderInstruction.getInstructionLength( encoder.fullU32Array[ address ] );
    }
    const exitAddress = address;

    const locations: ( RenderInstructionLocation | null )[] = instructionAddresses.map( () => null );
    locations.push( null ); // Add the exit location

    const getIndexOfAddress = ( address: number ): number => {
      if ( address === exitAddress ) {
        return instructionAddresses.length;
      }
      const index = instructionAddresses.indexOf( address );
      assert && assert( index >= 0 );
      return index;
    };
    const getLocation = ( index: number ): RenderInstructionLocation => {
      if ( locations[ index ] === null ) {
        locations[ index ] = new RenderInstructionLocation();
      }
      return locations[ index ]!;
    };
    const getLocationOfAddress = ( address: number ): RenderInstructionLocation => {
      return getLocation( getIndexOfAddress( address ) );
    };

    const instructions: RenderInstruction[] = [];
    for ( let i = 0; i < instructionAddresses.length; i++ ) {
      const address = instructionAddresses[ i ];
      const instruction = RenderInstruction.binaryToInstruction( encoder, address, addressOffset => {
        return getLocationOfAddress( address + addressOffset );
      } );

      // Possible location instruction (takes up zero length) will go first
      const location = locations[ i ];
      if ( location ) {
        instructions.push( location );
      }
      instructions.push( instruction );
    }
    // Potential ending location instruction
    const lastLocation = locations[ instructionAddresses.length ];
    if ( lastLocation ) {
      instructions.push( lastLocation );
    }

    return instructions;
  }

  public static binaryToInstruction(
    encoder: ByteEncoder,
    offset: number,
    getLocation: ( offset: number ) => RenderInstructionLocation
  ): RenderInstruction {
    const code = encoder.fullU32Array[ offset ] & 0xff;

    switch( code ) {
      case RenderInstruction.ReturnCode:
        return RenderInstructionReturn.INSTANCE;
      case RenderInstruction.PremultiplyCode:
        return RenderInstructionPremultiply.INSTANCE;
      case RenderInstruction.UnpremultiplyCode:
        return RenderInstructionUnpremultiply.INSTANCE;
      case RenderInstruction.StackBlendCode:
        return RenderInstructionStackBlend.INSTANCE;
      case RenderInstruction.LinearBlendCode:
        return RenderInstructionLinearBlend.INSTANCE;
      case RenderInstruction.LinearDisplayP3ToLinearSRGBCode:
        return RenderInstructionLinearDisplayP3ToLinearSRGB.INSTANCE;
      case RenderInstruction.LinearSRGBToLinearDisplayP3Code:
        return RenderInstructionLinearSRGBToLinearDisplayP3.INSTANCE;
      case RenderInstruction.LinearSRGBToOklabCode:
        return RenderInstructionLinearSRGBToOklab.INSTANCE;
      case RenderInstruction.LinearSRGBToSRGBCode:
        return RenderInstructionLinearSRGBToSRGB.INSTANCE;
      case RenderInstruction.OklabToLinearSRGBCode:
        return RenderInstructionOklabToLinearSRGB.INSTANCE;
      case RenderInstruction.SRGBToLinearSRGBCode:
        return RenderInstructionSRGBToLinearSRGB.INSTANCE;
      case RenderInstruction.NormalizeCode:
        return RenderInstructionNormalize.INSTANCE;
      case RenderInstruction.ExitCode:
        return RenderInstructionExit.INSTANCE;
      case RenderInstruction.BlendComposeCode:
        return RenderInstructionBlendCompose.fromBinary( encoder, offset, getLocation );
      case RenderInstruction.OpaqueJumpCode:
        return RenderInstructionOpaqueJump.fromBinary( encoder, offset, getLocation );
      case RenderInstruction.NormalDebugCode:
        return RenderInstructionNormalDebug.INSTANCE;
      case RenderInstruction.MultiplyScalarCode:
        return RenderInstructionMultiplyScalar.fromBinary( encoder, offset, getLocation );
      case RenderInstruction.PhongCode:
        return RenderInstructionPhong.fromBinary( encoder, offset, getLocation );
      case RenderInstruction.PushCode:
        return RenderInstructionPush.fromBinary( encoder, offset, getLocation );
      case RenderInstruction.ComputeLinearBlendRatioCode:
      case RenderInstruction.ComputeRadialBlendRatioCode:
        return RenderInstructionComputeBlendRatio.fromBinary( encoder, offset, getLocation );
      case RenderInstruction.BarycentricBlendCode:
        return RenderInstructionBarycentricBlend.fromBinary( encoder, offset, getLocation );
      case RenderInstruction.BarycentricPerspectiveBlendCode:
        return RenderInstructionBarycentricPerspectiveBlend.fromBinary( encoder, offset, getLocation );
      case RenderInstruction.FilterCode:
        return RenderInstructionFilter.fromBinary( encoder, offset, getLocation );
      case RenderInstruction.ComputeLinearGradientRatioCode:
      case RenderInstruction.ComputeRadialGradientRatioCode:
        return RenderInstructionComputeGradientRatio.fromBinary( encoder, offset, getLocation );
      default:
        throw new Error( `Unknown/unimplemented instruction code: ${code}` );
    }
  }

  public static instructionsEquals( a: RenderInstruction[], b: RenderInstruction[] ): boolean {
    const aFiltered = a.filter( instruction => !( instruction instanceof RenderInstructionLocation ) );
    const bFiltered = b.filter( instruction => !( instruction instanceof RenderInstructionLocation ) );

    if ( aFiltered.length !== bFiltered.length ) {
      return false;
    }

    // Count how many "non-location" instructions deep each location is, so we can compare them
    const locationIndexMap = new Map<RenderInstructionLocation, number>();
    const process = ( instructions: RenderInstruction[] ): void => {
      let count = 0;
      for ( let i = 0; i < instructions.length; i++ ) {
        const instruction = instructions[ i ];
        if ( instruction instanceof RenderInstructionLocation ) {
          locationIndexMap.set( instruction, count );
        }
        else {
          count++;
        }
      }
    };
    process( a );
    process( b );

    const areLocationsEqual = ( a: RenderInstructionLocation, b: RenderInstructionLocation ) => {
      return locationIndexMap.get( a ) === locationIndexMap.get( b );
    };

    for ( let i = 0; i < aFiltered.length; i++ ) {
      const aInstruction = aFiltered[ i ];
      const bInstruction = bFiltered[ i ];

      if ( !aInstruction.equals( bInstruction, areLocationsEqual ) ) {
        return false;
      }
    }

    return true;
  }
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

  public static fromBinary(
    encoder: ByteEncoder,
    offset: number,
    getLocation: ( offset: number ) => RenderInstructionLocation
  ): RenderInstructionPush {
    return new RenderInstructionPush( new Vector4(
      encoder.fullF32Array[ offset + 1 ],
      encoder.fullF32Array[ offset + 2 ],
      encoder.fullF32Array[ offset + 3 ],
      encoder.fullF32Array[ offset + 4 ]
    ) );
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

  public static fromBinary(
    encoder: ByteEncoder,
    offset: number,
    getLocation: ( offset: number ) => RenderInstructionLocation
  ): RenderInstructionMultiplyScalar {
    return new RenderInstructionMultiplyScalar( encoder.fullF32Array[ offset + 1 ] );
  }

  public override getBinaryLength(): number {
    return 2;
  }
}

alpenglow.register( 'RenderInstruction', RenderInstruction );
