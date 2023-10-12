// Copyright 2023, University of Colorado Boulder

/**
 * RenderProgram for applying a color-matrix filter
 *
 * NOTE: This operates on unpremultiplied colors. Presumably for most operations, you'll want to wrap it in
 * the corresponding conversions.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { RenderColor, RenderEvaluationContext, RenderPathBoolean, RenderProgram, alpenglow, SerializedRenderProgram, RenderInstruction, RenderExecutionStack, RenderExecutor, RenderInstructionLocation, ByteEncoder } from '../imports.js';
import Matrix4 from '../../../dot/js/Matrix4.js';
import Vector4 from '../../../dot/js/Vector4.js';

export default class RenderFilter extends RenderProgram {

  public readonly logic: RenderFilterLogic;

  public constructor(
    public readonly program: RenderProgram,
    public readonly colorMatrix: Matrix4,
    public readonly colorTranslation: Vector4,
    logic?: RenderFilterLogic
  ) {
    const alphaBasedOnColor = colorMatrix.m30() !== 0 || colorMatrix.m31() !== 0 || colorMatrix.m32() !== 0;

    let isFullyTransparent;
    let isFullyOpaque;

    // If we modify alpha based on color value, we can't make guarantees
    if ( alphaBasedOnColor ) {
      isFullyTransparent = false;
      isFullyOpaque = false;
    }
    else if ( program.isFullyTransparent ) {
      isFullyTransparent = colorTranslation.w === 0;
      isFullyOpaque = colorTranslation.w === 1;
    }
    else if ( program.isFullyOpaque ) {
      isFullyTransparent = colorMatrix.m33() + colorTranslation.w === 0;
      isFullyOpaque = colorMatrix.m33() + colorTranslation.w === 1;
    }
    else {
      isFullyTransparent = colorMatrix.m33() === 0 && colorTranslation.w === 0;
      isFullyOpaque = colorMatrix.m33() === 0 && colorTranslation.w === 1;
    }

    super(
      [ program ],
      isFullyTransparent,
      isFullyOpaque
    );

    this.logic = logic || new RenderFilterLogic( this.colorMatrix, this.colorTranslation );
  }

  public override getName(): string {
    return 'RenderFilter';
  }

  public override withChildren( children: RenderProgram[] ): RenderFilter {
    assert && assert( children.length === 1 );
    return new RenderFilter( children[ 0 ], this.colorMatrix, this.colorTranslation, this.logic );
  }

  protected override equalsTyped( other: this ): boolean {
    return this.colorMatrix.equals( other.colorMatrix ) &&
           this.colorTranslation.equals( other.colorTranslation );
  }

  protected override getSimplified( children: RenderProgram[] ): RenderProgram | null {
    const program = children[ 0 ];

    // TODO: concatenated filters! Matrix multiplication
    // TODO: concatenated RenderAlpha + RenderFilter, RenderFilter + RenderAlpha (matrix multiplication)
    // TODO: matrix could be turned into RenderAlpha or a no-op!

    if ( program instanceof RenderColor ) {
      return new RenderColor( RenderFilter.applyFilter( program.color, this.colorMatrix, this.colorTranslation ) );
    }
    // Move our path-booleans "up" to the top level (so we can combine other things AND improve path-boolean replacement performance)
    else if ( program instanceof RenderPathBoolean && program.isOneSided() ) {
      return program.withOneSide( this.withChildren( [ program.getOneSide() ] ) ).simplified();
    }
    else {
      return null;
    }
  }

  public override evaluate( context: RenderEvaluationContext ): Vector4 {
    const source = this.program.evaluate( context );

    return RenderFilter.applyFilter( source, this.colorMatrix, this.colorTranslation );
  }

  public override writeInstructions( instructions: RenderInstruction[] ): void {
    this.program.writeInstructions( instructions );
    instructions.push( new RenderInstructionFilter( this.logic ) );
  }

  public static applyFilter( color: Vector4, colorMatrix: Matrix4, colorTranslation: Vector4 ): Vector4 {
    // TODO: GC friendly optimizations?
    return colorMatrix.timesVector4( color ).plus( colorTranslation );
  }

  public override serialize(): SerializedRenderFilter {
    return {
      type: 'RenderFilter',
      program: this.program.serialize(),
      colorMatrix: [
        this.colorMatrix.m00(), this.colorMatrix.m01(), this.colorMatrix.m02(), this.colorMatrix.m03(),
        this.colorMatrix.m10(), this.colorMatrix.m11(), this.colorMatrix.m12(), this.colorMatrix.m13(),
        this.colorMatrix.m20(), this.colorMatrix.m21(), this.colorMatrix.m22(), this.colorMatrix.m23(),
        this.colorMatrix.m30(), this.colorMatrix.m31(), this.colorMatrix.m32(), this.colorMatrix.m33()
      ],
      colorTranslation: [
        this.colorTranslation.x, this.colorTranslation.y, this.colorTranslation.z, this.colorTranslation.w
      ]
    };
  }

  public static override deserialize( obj: SerializedRenderFilter ): RenderFilter {
    return new RenderFilter(
      RenderProgram.deserialize( obj.program ),
      new Matrix4( ...obj.colorMatrix ),
      new Vector4( obj.colorTranslation[ 0 ], obj.colorTranslation[ 1 ], obj.colorTranslation[ 2 ], obj.colorTranslation[ 3 ] )
    );
  }
}

alpenglow.register( 'RenderFilter', RenderFilter );

export class RenderFilterLogic {
  public constructor(
    public readonly colorMatrix: Matrix4,
    public readonly colorTranslation: Vector4
  ) {}

  public equals( other: RenderFilterLogic ): boolean {
    return this.colorMatrix.equalsEpsilon( other.colorMatrix, 1e-6 ) &&
           this.colorTranslation.equalsEpsilon( other.colorTranslation, 1e-6 );
  }
}

const scratchVector = new Vector4( 0, 0, 0, 0 );

export class RenderInstructionFilter extends RenderInstruction {
  public constructor(
    public readonly logic: RenderFilterLogic
  ) {
    super();
  }

  public override toString(): string {
    return 'RenderInstructionFilter(TODO)';
  }

  public override equals(
    other: RenderInstruction,
    areLocationsEqual: ( a: RenderInstructionLocation, b: RenderInstructionLocation ) => boolean
  ): boolean {
    return other instanceof RenderInstructionFilter && this.logic.equals( other.logic );
  }

  public override execute(
    stack: RenderExecutionStack,
    context: RenderEvaluationContext,
    executor: RenderExecutor
  ): void {
    stack.readTop( scratchVector );
    RenderFilter.applyFilter( scratchVector, this.logic.colorMatrix, this.logic.colorTranslation );
    stack.writeTop( scratchVector );
  }

  public override writeBinary( encoder: ByteEncoder, getOffset: ( location: RenderInstructionLocation ) => number ): void {
    encoder.pushU32( RenderInstruction.FilterCode ); // 0
    encoder.pushF32( this.logic.colorMatrix.m00() ); // 1
    encoder.pushF32( this.logic.colorMatrix.m01() ); // 2
    encoder.pushF32( this.logic.colorMatrix.m02() ); // 3
    encoder.pushF32( this.logic.colorMatrix.m03() ); // 4
    encoder.pushF32( this.logic.colorMatrix.m10() ); // 5
    encoder.pushF32( this.logic.colorMatrix.m11() ); // 6
    encoder.pushF32( this.logic.colorMatrix.m12() ); // 7
    encoder.pushF32( this.logic.colorMatrix.m13() ); // 8
    encoder.pushF32( this.logic.colorMatrix.m20() ); // 9
    encoder.pushF32( this.logic.colorMatrix.m21() ); // 10
    encoder.pushF32( this.logic.colorMatrix.m22() ); // 11
    encoder.pushF32( this.logic.colorMatrix.m23() ); // 12
    encoder.pushF32( this.logic.colorMatrix.m30() ); // 13
    encoder.pushF32( this.logic.colorMatrix.m31() ); // 14
    encoder.pushF32( this.logic.colorMatrix.m32() ); // 15
    encoder.pushF32( this.logic.colorMatrix.m33() ); // 16
    encoder.pushF32( this.logic.colorTranslation.x ); // 17
    encoder.pushF32( this.logic.colorTranslation.y ); // 18
    encoder.pushF32( this.logic.colorTranslation.z ); // 19
    encoder.pushF32( this.logic.colorTranslation.w ); // 20
  }

  public static fromBinary(
    encoder: ByteEncoder,
    offset: number,
    getLocation: ( offset: number ) => RenderInstructionLocation
  ): RenderInstructionFilter {
    return new RenderInstructionFilter( new RenderFilterLogic( new Matrix4(
      encoder.fullF32Array[ offset + 1 ],
      encoder.fullF32Array[ offset + 2 ],
      encoder.fullF32Array[ offset + 3 ],
      encoder.fullF32Array[ offset + 4 ],
      encoder.fullF32Array[ offset + 5 ],
      encoder.fullF32Array[ offset + 6 ],
      encoder.fullF32Array[ offset + 7 ],
      encoder.fullF32Array[ offset + 8 ],
      encoder.fullF32Array[ offset + 9 ],
      encoder.fullF32Array[ offset + 10 ],
      encoder.fullF32Array[ offset + 11 ],
      encoder.fullF32Array[ offset + 12 ],
      encoder.fullF32Array[ offset + 13 ],
      encoder.fullF32Array[ offset + 14 ],
      encoder.fullF32Array[ offset + 15 ],
      encoder.fullF32Array[ offset + 16 ]
    ), new Vector4(
      encoder.fullF32Array[ offset + 17 ],
      encoder.fullF32Array[ offset + 18 ],
      encoder.fullF32Array[ offset + 19 ],
      encoder.fullF32Array[ offset + 20 ]
    ) ) );
  }

  public override getBinaryLength(): number {
    return 21;
  }
}

export type SerializedRenderFilter = {
  type: 'RenderFilter';
  program: SerializedRenderProgram;
  colorMatrix: number[];
  colorTranslation: number[];
};
