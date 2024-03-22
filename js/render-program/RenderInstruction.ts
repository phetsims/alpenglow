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
   * The number of dwords (u32s, 4 bytes) that this instruction takes up in the binary stream.
   */
  public abstract getBinaryLength(): number;

  // TODO: better code ordering, prevent duplicates
  // length 1
  // NOTE: only instructions with length 1 should fit in the mask 0xf (4 bits)
  // This condition will be detected
  public static readonly ExitCode = 0x00;
  public static readonly ReturnCode = 0x01;
  public static readonly StackBlendCode = 0x02;
  public static readonly LinearBlendCode = 0x03;
  public static readonly BlendComposeCode = 0x04;
  public static readonly OpaqueJumpCode = 0x05;
  public static readonly PremultiplyCode = 0x06;
  public static readonly UnpremultiplyCode = 0x07;
  public static readonly SRGBToLinearSRGBCode = 0x08;
  public static readonly LinearSRGBToSRGBCode = 0x09;
  public static readonly LinearDisplayP3ToLinearSRGBCode = 0x0a;
  public static readonly LinearSRGBToLinearDisplayP3Code = 0x0b;
  public static readonly OklabToLinearSRGBCode = 0x0c;
  public static readonly LinearSRGBToOklabCode = 0x0d;
  public static readonly NormalizeCode = 0x0e;
  public static readonly NormalDebugCode = 0x0f;

  // Below here, the top bit MUST be set. This is to prevent the 0xf mask from matching these codes.
  // The bottom 5 bits will be used for the length (FOR NOW, this could change), and the 2 bits after will be used to
  // represent different instructions.
  // NOTE: If we have 4 more 1-length instructions, we'll need to figure out a different encoding here
  // NOTE: Actually, we really won't. For all of those 1-length ones, we can just PACK EVERYTHING IN THE HIGH BITS
  // NOTE: top 2 bits set will note variadic instructions.
  // So add... 0x80, 0xa0 as the two options

  // length 2
  public static readonly MultiplyScalarCode = 2 + 0x80;

  // length 3
  public static readonly PhongCode = 3 + 0x80;

  // length 5
  public static readonly PushCode = 5 + 0x80;

  // length 7
  public static readonly ComputeLinearBlendRatioCode = 7 + 0x80;

  // length 8
  public static readonly BarycentricBlendCode = 8 + 0x80;

  // length 11
  public static readonly BarycentricPerspectiveBlendCode = 11 + 0x80;

  // length 12
  public static readonly ComputeRadialBlendRatioCode = 12 + 0x80;

  // length 21
  public static readonly FilterCode = 21 + 0x80;

  // variable length(!)
  public static readonly ComputeLinearGradientRatioCode = 12 + 0xc0;
  public static readonly ComputeRadialGradientRatioCode = 10 + 0xc0;

  public static readonly ImageCode = 0xff; // TODO: temporary placeholder

  // Something we can pass in shader options.
  public static readonly CODE_NAME_CONSTANTS = {
    ExitCode: RenderInstruction.ExitCode,
    ReturnCode: RenderInstruction.ReturnCode,
    StackBlendCode: RenderInstruction.StackBlendCode,
    LinearBlendCode: RenderInstruction.LinearBlendCode,
    BlendComposeCode: RenderInstruction.BlendComposeCode,
    OpaqueJumpCode: RenderInstruction.OpaqueJumpCode,
    PremultiplyCode: RenderInstruction.PremultiplyCode,
    UnpremultiplyCode: RenderInstruction.UnpremultiplyCode,
    SRGBToLinearSRGBCode: RenderInstruction.SRGBToLinearSRGBCode,
    LinearSRGBToSRGBCode: RenderInstruction.LinearSRGBToSRGBCode,
    LinearDisplayP3ToLinearSRGBCode: RenderInstruction.LinearDisplayP3ToLinearSRGBCode,
    LinearSRGBToLinearDisplayP3Code: RenderInstruction.LinearSRGBToLinearDisplayP3Code,
    OklabToLinearSRGBCode: RenderInstruction.OklabToLinearSRGBCode,
    LinearSRGBToOklabCode: RenderInstruction.LinearSRGBToOklabCode,
    NormalizeCode: RenderInstruction.NormalizeCode,
    NormalDebugCode: RenderInstruction.NormalDebugCode,
    MultiplyScalarCode: RenderInstruction.MultiplyScalarCode,
    PhongCode: RenderInstruction.PhongCode,
    PushCode: RenderInstruction.PushCode,
    ComputeLinearBlendRatioCode: RenderInstruction.ComputeLinearBlendRatioCode,
    BarycentricBlendCode: RenderInstruction.BarycentricBlendCode,
    BarycentricPerspectiveBlendCode: RenderInstruction.BarycentricPerspectiveBlendCode,
    ComputeRadialBlendRatioCode: RenderInstruction.ComputeRadialBlendRatioCode,
    FilterCode: RenderInstruction.FilterCode,
    ComputeLinearGradientRatioCode: RenderInstruction.ComputeLinearGradientRatioCode,
    ComputeRadialGradientRatioCode: RenderInstruction.ComputeRadialGradientRatioCode,
    ImageCode: RenderInstruction.ImageCode
  } as const;

  /**
   * Returns the length (in dwords) of the binary form of an instruction, based on the initial u32 value in the
   * instruction stream
   */
  public static getInstructionLength( u32: number ): number {
    const code = u32 & 0xff;

    // High 4 bits all zero => 1 length
    if ( code >> 4 === 0 ) {
      return 1;
    }
    // High 2 bits set => variable length
    else if ( code & 0xc0 ) {
      // TODO: factor out a better convention if this becomes more set
      return code & 0x1f + 2 * ( u32 >> RenderInstructionComputeGradientRatio.GRADIENT_BEFORE_RATIO_COUNT_BITS );
    }
    // Just high bit set, we'll read the length in the lower-5 bits
    else {
      return code & 0x1f;
    }
  }

  /**
   * Appends the binary form of the list of instructions to the encoder.
   *
   * NOTE: The binary form will always have an exit instruction included at the end, so multiple instruction streams
   * can be written into the same buffer (and noted with offsets).
   */
  public static instructionsToBinary( encoder: ByteEncoder, instructions: RenderInstruction[] ): void {
    // Stores the number of dwords (u32s, 4 bytes) before each instruction, by index.
    // Thus instructions[ i ] will have lengthPrefixSum[ i ] dwords before it.
    // This is needed, so that we can compute locations/offsets for jumps in instructions.
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

  /**
   * Reads the binary from from the encoder (at a specific dword offset), and returns the list of instructions.
   *
   * NOTE: No final "exit" is generated, since our executor for objects won't need it.
   */
  public static binaryToInstructions( encoder: ByteEncoder, offset: number ): RenderInstruction[] {

    // Compute the addresses of every instruction (based on its length), and read through all of the instructions
    // up through the exit.
    const instructionAddresses: number[] = [];
    let address = offset;
    while ( encoder.fullU32Array[ address ] !== RenderInstruction.ExitCode ) {
      instructionAddresses.push( address );
      address += RenderInstruction.getInstructionLength( encoder.fullU32Array[ address ] );
    }
    const exitAddress = address;

    // We'll lazy-load locations, since we (a) don't want to create them if they aren't needed, and (b) we only want
    // one for each "address" (so multiple instructions could potentially point to the same location).
    const locations: ( RenderInstructionLocation | null )[] = instructionAddresses.map( () => null );
    locations.push( null ); // Add the exit location

    // Given an instruction address, return its index on our list of non-location instructions
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

    // We'll need to merge together our location-instructions with non-location instructions. Since jumps are only
    // forward, we can just compute binary instructions in order.
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
    // Potential ending location instruction (e.g. if there is a jump to the exit at the end).
    const lastLocation = locations[ instructionAddresses.length ];
    if ( lastLocation ) {
      instructions.push( lastLocation );
    }

    return instructions;
  }

  /**
   * Extracts a single instruction from the binary format at a given (32bit dword) offset.
   */
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

  /**
   * Returns whether two instruction lists are equivalent (allowing for equivalent location instructions).
   *
   * It's possible to have one list where there are multiple location instructions in a row, so we'll need to
   * inspect locations for these cases (since they can be equivalent to a single location instruction).
   */
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