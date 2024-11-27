// Copyright 2023-2024, University of Colorado Boulder

/**
 * RenderProgram for a classic linear gradient
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import Matrix3 from '../../../dot/js/Matrix3.js';
import Vector2 from '../../../dot/js/Vector2.js';
import Vector4 from '../../../dot/js/Vector4.js';
import { alpenglow, ByteEncoder, RenderableFace, RenderColor, RenderEvaluationContext, RenderExecutionStack, RenderExecutor, RenderExtend, RenderGradientStop, RenderImage, RenderInstruction, RenderInstructionLinearBlend, RenderInstructionLocation, RenderInstructionReturn, RenderLinearBlend, RenderLinearBlendAccuracy, RenderLinearRange, RenderProgram, RenderRadialGradientLogic, SerializedRenderGradientStop } from '../imports.js';

export enum RenderLinearGradientAccuracy {
  SplitAccurate = 0,
  SplitPixelCenter = 1,
  UnsplitCentroid = 2,
  UnsplitPixelCenter = 3
  // Restricted to 2-bit length, if adding more, check serialization to binary
}

alpenglow.register( 'RenderLinearGradientAccuracy', RenderLinearGradientAccuracy );

const scratchLinearGradientVector0 = new Vector2( 0, 0 );

const toProgram = ( item: RenderGradientStop ): RenderProgram => item.program;

export default class RenderLinearGradient extends RenderProgram {

  public readonly logic: RenderLinearGradientLogic;

  public constructor(
    public readonly transform: Matrix3,
    public readonly start: Vector2,
    public readonly end: Vector2,
    public readonly stops: RenderGradientStop[], // should be sorted!!
    public readonly extend: RenderExtend,
    public readonly accuracy: RenderLinearGradientAccuracy,
    logic?: RenderLinearGradientLogic
  ) {
    assert && assert( transform.isFinite() );
    assert && assert( start.isFinite() );
    assert && assert( end.isFinite() );
    assert && assert( !start.equals( end ) );

    assert && assert( _.range( 0, stops.length - 1 ).every( i => {
      return stops[ i ].ratio <= stops[ i + 1 ].ratio;
    } ), 'RenderLinearGradient stops not monotonically increasing' );

    const children = stops.map( toProgram );

    super(
      children,
      _.every( children, RenderProgram.closureIsFullyTransparent ),
      _.every( children, RenderProgram.closureIsFullyOpaque ),
      false,
      false,
      accuracy === RenderLinearGradientAccuracy.UnsplitCentroid || accuracy === RenderLinearGradientAccuracy.SplitAccurate
    );

    this.logic = logic || RenderLinearGradientLogic.from( this.transform, this.start, this.end, this.stops.map( stop => stop.ratio ), this.extend, this.accuracy );
  }

  public override getName(): string {
    return 'RenderLinearGradient';
  }

  public override withChildren( children: RenderProgram[] ): RenderLinearGradient {
    assert && assert( children.length === this.stops.length );
    return new RenderLinearGradient( this.transform, this.start, this.end, this.stops.map( ( stop, i ) => {
      return new RenderGradientStop( stop.ratio, children[ i ] );
    } ), this.extend, this.accuracy, this.logic );
  }

  public override isSplittable(): boolean {
    return this.accuracy === RenderLinearGradientAccuracy.SplitAccurate ||
           this.accuracy === RenderLinearGradientAccuracy.SplitPixelCenter;
  }

  public override transformed( transform: Matrix3 ): RenderProgram {
    return new RenderLinearGradient(
      transform.timesMatrix( this.transform ),
      this.start,
      this.end,
      this.stops.map( stop => new RenderGradientStop( stop.ratio, stop.program.transformed( transform ) ) ),
      this.extend,
      this.accuracy
    );
  }

  protected override equalsTyped( other: this ): boolean {
    return this.transform.equals( other.transform ) &&
      this.start.equals( other.start ) &&
      this.end.equals( other.end ) &&
      this.extend === other.extend &&
      this.accuracy === other.accuracy &&
      this.stops.length === other.stops.length &&
      _.every( this.stops, ( stop, i ) => stop.ratio === other.stops[ i ].ratio );
  }

  protected override getSimplified( children: RenderProgram[] ): RenderProgram | null {
    const simplifiedColorStops = this.stops.map( ( stop, i ) => stop.withProgram( children[ i ] ) );

    // TODO: compaction of triplicate stops

    if ( simplifiedColorStops.every( stop => stop.program.isFullyTransparent ) ) {
      return RenderColor.TRANSPARENT;
    }
    else {
      return null;
    }
  }

  public override evaluate( context: RenderEvaluationContext ): Vector4 {
    return RenderGradientStop.evaluate( context, this.stops, this.logic.computeLinearValue( context ) );
  }

  public override writeInstructions( instructions: RenderInstruction[] ): void {
    const stopLocations = this.stops.map( stop => new RenderInstructionLocation() );
    const blendLocation = new RenderInstructionLocation();

    instructions.push( new RenderInstructionComputeGradientRatio( this.logic, stopLocations, blendLocation ) );
    for ( let i = 0; i < this.stops.length; i++ ) {
      instructions.push( stopLocations[ i ] );
      this.stops[ i ].program.writeInstructions( instructions );
      instructions.push( RenderInstructionReturn.INSTANCE );
    }
    instructions.push( blendLocation );
    instructions.push( RenderInstructionLinearBlend.INSTANCE );
  }

  public override split( face: RenderableFace ): RenderableFace[] {

    const start = this.transform.timesVector2( this.start );
    const end = this.transform.timesVector2( this.end );

    const blendAccuracy = this.accuracy === RenderLinearGradientAccuracy.SplitAccurate ?
                          RenderLinearBlendAccuracy.Accurate :
                          RenderLinearBlendAccuracy.PixelCenter;
    const delta = this.end.minus( this.start );

    // By squaring the magnitude we create an inverse magnitude the same way our scaled normal will as well.
    const localScaledNormal = delta.timesScalar( 1 / delta.magnitudeSquared );

    // This transform retains our inverse magnitude from above.
    const normal = this.transform.inverted().timesTransposeVector2( localScaledNormal );
    const offset = normal.dot( start );

    // Should evaluate to 1 at the end
    assert && assert( Math.abs( normal.dot( end ) - offset - 1 ) < 1e-8 );

    const dotRange = face.face.getDotRange( normal );

    // relative to gradient "origin"
    const min = dotRange.min - offset;
    const max = dotRange.max - offset;

    const linearRanges = RenderLinearRange.getGradientLinearRanges( min, max, offset, this.extend, this.stops );

    if ( linearRanges.length < 2 ) {
      // TODO: We should be doing a replacement with a RenderLinearBlend here if possible!
      return [ face ];
    }
    else {
      const splitValues = linearRanges.map( range => range.start ).slice( 1 );
      const clippedFaces = face.face.getStripeLineClip( normal, splitValues, 0 );

      const renderableFaces = linearRanges.map( ( range, i ) => {
        const clippedFace = clippedFaces[ i ];

        const replacer = ( renderProgram: RenderProgram ): RenderProgram | null => {
          if ( renderProgram !== this ) {
            return null;
          }

          if ( range.startProgram === range.endProgram ) {
            return range.startProgram.replace( replacer );
          }
          else {
            // We need to rescale our normal for the linear blend, and then adjust our offset to point to the
            // "start":
            // From our original formulation:
            //   normal.dot( startPoint ) = range.start
            //   normal.dot( endPoint ) = range.end
            // with a difference of (range.end - range.start). We want this to be zero, so we rescale our normal:
            //   newNormal.dot( startPoint ) = range.start / ( range.end - range.start )
            //   newNormal.dot( endPoint ) = range.end / ( range.end - range.start )
            // And then we can adjust our offset such that:
            //   newNormal.dot( startPoint ) - offset = 0
            //   newNormal.dot( endPoint ) - offset = 1
            const scaledNormal = normal.timesScalar( 1 / ( range.end - range.start ) );
            const scaledOffset = range.start / ( range.end - range.start );

            return new RenderLinearBlend(
              scaledNormal,
              scaledOffset,
              blendAccuracy,
              range.startProgram.replace( replacer ),
              range.endProgram.replace( replacer )
            );
          }
        };

        return new RenderableFace( clippedFace, face.renderProgram.replace( replacer ).simplified(), clippedFace.getBounds() );
      } ).filter( face => face.face.getArea() > 1e-8 );

      return renderableFaces;
    }
  }

  public override serialize(): SerializedRenderLinearGradient {
    return {
      type: 'RenderLinearGradient',
      transform: [
        this.transform.m00(), this.transform.m01(), this.transform.m02(),
        this.transform.m10(), this.transform.m11(), this.transform.m12(),
        this.transform.m20(), this.transform.m21(), this.transform.m22()
      ],
      start: [ this.start.x, this.start.y ],
      end: [ this.end.x, this.end.y ],
      stops: this.stops.map( stop => stop.serialize() ),
      extend: this.extend,
      accuracy: this.accuracy
    };
  }

  public static override deserialize( obj: SerializedRenderLinearGradient ): RenderLinearGradient {
    return new RenderLinearGradient(
      Matrix3.rowMajor(
        obj.transform[ 0 ], obj.transform[ 1 ], obj.transform[ 2 ],
        obj.transform[ 3 ], obj.transform[ 4 ], obj.transform[ 5 ],
        obj.transform[ 6 ], obj.transform[ 7 ], obj.transform[ 8 ]
      ),
      new Vector2( obj.start[ 0 ], obj.start[ 1 ] ),
      new Vector2( obj.end[ 0 ], obj.end[ 1 ] ),
      obj.stops.map( stop => RenderGradientStop.deserialize( stop ) ),
      obj.extend,
      obj.accuracy
    );
  }
}

alpenglow.register( 'RenderLinearGradient', RenderLinearGradient );

export class RenderLinearGradientLogic {

  private readonly isIdentity: boolean;

  public constructor(
    public readonly inverseTransform: Matrix3,
    public readonly start: Vector2,
    public readonly gradDelta: Vector2,
    public readonly ratios: number[],
    public readonly extend: RenderExtend,
    public readonly accuracy: RenderLinearGradientAccuracy
  ) {
    // Not computed on GPU?
    this.isIdentity = inverseTransform.isIdentity();
  }

  public static from(
    transform: Matrix3,
    start: Vector2,
    end: Vector2,
    ratios: number[],
    extend: RenderExtend,
    accuracy: RenderLinearGradientAccuracy
  ): RenderLinearGradientLogic {
    const inverseTransform = transform.inverted();
    const gradDelta = end.minus( start );

    return new RenderLinearGradientLogic( inverseTransform, start, gradDelta, ratios, extend, accuracy );
  }

  public equals( other: RenderLinearGradientLogic ): boolean {
    return this.inverseTransform.equalsEpsilon( other.inverseTransform, 1e-6 ) &&
           this.start.equalsEpsilon( other.start, 1e-6 ) &&
           this.gradDelta.equalsEpsilon( other.gradDelta, 1e-6 ) &&
           this.ratios.length === other.ratios.length &&
           this.ratios.every( ( ratio, i ) => Math.abs( ratio - other.ratios[ i ] ) < 1e-6 ) &&
           this.extend === other.extend &&
           this.accuracy === other.accuracy;
  }

  public computeLinearValue(
    context: RenderEvaluationContext
  ): number {
    const useCentroid = this.accuracy === RenderLinearGradientAccuracy.UnsplitCentroid ||
                        this.accuracy === RenderLinearGradientAccuracy.SplitAccurate;

    assert && useCentroid && assert( context.hasCentroid() );

    const localPoint = useCentroid ?
      scratchLinearGradientVector0.set( context.centroid ) :
      context.writeBoundsCentroid( scratchLinearGradientVector0 );

    if ( !this.isIdentity ) {
      this.inverseTransform.multiplyVector2( localPoint );
    }

    const localDelta = localPoint.subtract( this.start ); // MUTABLE, changes localPoint
    const gradDelta = this.gradDelta;

    const rawT = gradDelta.magnitude > 0 ? localDelta.dot( gradDelta ) / gradDelta.dot( gradDelta ) : 0;

    return RenderImage.extend( this.extend, rawT );
  }
}

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
    if ( this.logic instanceof RenderLinearGradientLogic ) {
      const inverseTransform = `inverseTransform:${this.logic.inverseTransform.m00()},${this.logic.inverseTransform.m01()},${this.logic.inverseTransform.m02()},${this.logic.inverseTransform.m10()},${this.logic.inverseTransform.m11()},${this.logic.inverseTransform.m12()}`;
      const start = `start:${this.logic.start.x},${this.logic.start.y}`;
      const gradDelta = `gradDelta:${this.logic.gradDelta.x},${this.logic.gradDelta.y}`;
      const extend = `extend:${this.logic.extend}`;
      const accuracy = `accuracy:${this.logic.accuracy}`;
      return `RenderInstructionComputeGradientRatio(linear, ${inverseTransform} ${start} ${gradDelta} ${extend} ${accuracy} ${ratios} ${stops} ${blend})`;
    }
    else {
      const conicTransform = `conicTransform:${this.logic.conicTransform.m00()},${this.logic.conicTransform.m01()},${this.logic.conicTransform.m02()},${this.logic.conicTransform.m10()},${this.logic.conicTransform.m11()},${this.logic.conicTransform.m12()}`;
      const focalX = `focalX:${this.logic.focalX}`;
      const radius = `radius:${this.logic.radius}`;
      const kind = `kind:${this.logic.kind}`;
      const isSwapped = `isSwapped:${this.logic.isSwapped}`;
      const accuracy = `accuracy:${this.logic.accuracy}`;
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
    if (
      this.logic instanceof RenderLinearGradientLogic && other.logic instanceof RenderLinearGradientLogic
    ) {
      return this.logic.equals( other.logic );
    }
    else if (
      this.logic instanceof RenderRadialGradientLogic && other.logic instanceof RenderRadialGradientLogic
    ) {
      return this.logic.equals( other.logic );
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

  public static readonly GRADIENT_BEFORE_RATIO_COUNT_BITS = 16;

  public override writeBinary( encoder: ByteEncoder, getOffset: ( location: RenderInstructionLocation ) => number ): void {

    const stopOffsets = this.stopLocations.map( getOffset );
    const blendOffset = getOffset( this.blendLocation );
    const ratios = this.logic.ratios;
    const ratioCount = ratios.length;

    if ( this.logic instanceof RenderLinearGradientLogic ) {
      encoder.pushU32(
        RenderInstruction.ComputeLinearGradientRatioCode |
        ( this.logic.accuracy << 8 ) | // 2-bit accuracy
        ( this.logic.extend << 11 ) | // 2-bit (extended to match radial case)
        ( ratioCount << RenderInstructionComputeGradientRatio.GRADIENT_BEFORE_RATIO_COUNT_BITS ) // extended to match the radial case
      ); // 0
      assert && assert( ratioCount < 2 ** ( 32 - RenderInstructionComputeGradientRatio.GRADIENT_BEFORE_RATIO_COUNT_BITS ) );

      encoder.pushF32( this.logic.inverseTransform.m00() ); // 1
      encoder.pushF32( this.logic.inverseTransform.m01() ); // 2
      encoder.pushF32( this.logic.inverseTransform.m02() ); // 3
      encoder.pushF32( this.logic.inverseTransform.m10() ); // 4
      encoder.pushF32( this.logic.inverseTransform.m11() ); // 5
      encoder.pushF32( this.logic.inverseTransform.m12() ); // 6
      encoder.pushF32( this.logic.start.x ); // 7
      encoder.pushF32( this.logic.start.y ); // 8
      encoder.pushF32( this.logic.gradDelta.x ); // 9
      encoder.pushF32( this.logic.gradDelta.y ); // 10

      encoder.pushU32( blendOffset ); // 11
      for ( let i = 0; i < ratioCount; i++ ) {
        encoder.pushF32( ratios[ i ] ); // 12 + 2 * i
        encoder.pushU32( stopOffsets[ i ] ); // 13 + 2 * i
      }
    }
    else {
      encoder.pushU32(
        RenderInstruction.ComputeRadialGradientRatioCode |
        ( this.logic.accuracy << 8 ) | // 3-bit accuracy
        ( this.logic.extend << 11 ) | // 2-bit
        ( this.logic.kind << 13 ) | // 2-bit
        ( this.logic.isSwapped ? 1 << 15 : 0 ) | // 1-bit
        ( ratioCount << RenderInstructionComputeGradientRatio.GRADIENT_BEFORE_RATIO_COUNT_BITS )
      ); // 0
      assert && assert( ratioCount < 2 ** ( 32 - RenderInstructionComputeGradientRatio.GRADIENT_BEFORE_RATIO_COUNT_BITS ) );

      encoder.pushF32( this.logic.conicTransform.m00() ); // 1
      encoder.pushF32( this.logic.conicTransform.m01() ); // 2
      encoder.pushF32( this.logic.conicTransform.m02() ); // 3
      encoder.pushF32( this.logic.conicTransform.m10() ); // 4
      encoder.pushF32( this.logic.conicTransform.m11() ); // 5
      encoder.pushF32( this.logic.conicTransform.m12() ); // 6
      encoder.pushF32( this.logic.focalX ); // 7
      encoder.pushF32( this.logic.radius ); // 8

      encoder.pushU32( blendOffset ); // 9
      for ( let i = 0; i < ratioCount; i++ ) {
        encoder.pushF32( ratios[ i ] ); // 10 + 2 * i
        encoder.pushU32( stopOffsets[ i ] ); // 11 + 2 * i
      }
    }
  }

  public static fromBinary(
    encoder: ByteEncoder,
    offset: number,
    getLocation: ( offset: number ) => RenderInstructionLocation
  ): RenderInstructionComputeGradientRatio {

    const first = encoder.fullU32Array[ offset ];
    const isLinear = ( first & 0xff ) === RenderInstruction.ComputeLinearGradientRatioCode;
    const accuracy = ( first >> 8 ) & 0x7;
    const extend = ( first >> 11 ) & 0x3;
    const ratioCount = first >> RenderInstructionComputeGradientRatio.GRADIENT_BEFORE_RATIO_COUNT_BITS;
    const transform = Matrix3.rowMajor(
      encoder.fullF32Array[ offset + 1 ],
      encoder.fullF32Array[ offset + 2 ],
      encoder.fullF32Array[ offset + 3 ],
      encoder.fullF32Array[ offset + 4 ],
      encoder.fullF32Array[ offset + 5 ],
      encoder.fullF32Array[ offset + 6 ],
      0, 0, 1
    );
    const blendOffset = offset + ( isLinear ? 11 : 9 );
    const ratioOffset = blendOffset + 1;

    const ratios: number[] = [];
    const stopLocations: RenderInstructionLocation[] = [];
    const blendLocation = getLocation( encoder.fullU32Array[ blendOffset ] );

    for ( let i = 0; i < ratioCount; i++ ) {
      ratios.push( encoder.fullF32Array[ ratioOffset + 2 * i ] );
      stopLocations.push( getLocation( encoder.fullU32Array[ ratioOffset + 2 * i + 1 ] ) );
    }

    if ( isLinear ) {
      const start = new Vector2(
        encoder.fullF32Array[ offset + 7 ],
        encoder.fullF32Array[ offset + 8 ]
      );
      const gradDelta = new Vector2(
        encoder.fullF32Array[ offset + 9 ],
        encoder.fullF32Array[ offset + 10 ]
      );

      return new RenderInstructionComputeGradientRatio(
        new RenderLinearGradientLogic(
          transform, // inverseTransform
          start,
          gradDelta,
          ratios,
          extend,
          accuracy
        ),
        stopLocations,
        blendLocation
      );
    }
    else {
      const kind = ( first >> 13 ) & 0x3;
      const isSwapped = ( first & ( 1 << 15 ) ) !== 0;
      const focalX = encoder.fullF32Array[ offset + 7 ];
      const radius = encoder.fullF32Array[ offset + 8 ];

      return new RenderInstructionComputeGradientRatio(
        new RenderRadialGradientLogic(
          transform, // conicTransform
          focalX,
          radius,
          kind,
          isSwapped,
          ratios,
          extend,
          accuracy
        ),
        stopLocations,
        blendLocation
      );
    }

  }

  public override getBinaryLength(): number {
    if ( this.logic instanceof RenderLinearGradientLogic ) {
      return 12 + 2 * this.logic.ratios.length;
    }
    else {
      return 10 + 2 * this.logic.ratios.length;
    }
  }
}

export type SerializedRenderLinearGradient = {
  type: 'RenderLinearGradient';
  transform: number[];
  start: number[];
  end: number[];
  stops: SerializedRenderGradientStop[];
  extend: RenderExtend;
  accuracy: RenderLinearGradientAccuracy;
};