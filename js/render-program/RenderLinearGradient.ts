// Copyright 2023, University of Colorado Boulder

/**
 * RenderProgram for a classic linear gradient
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { RenderableFace, RenderColor, RenderEvaluationContext, RenderExtend, RenderGradientStop, RenderImage, RenderLinearBlend, RenderLinearBlendAccuracy, RenderLinearRange, RenderProgram, alpenglow, SerializedRenderGradientStop, RenderInstruction, RenderRadialGradientLogic, RenderInstructionLocation, RenderExecutionStack, RenderExecutor, RenderInstructionReturn, RenderInstructionLinearBlend } from '../imports.js';
import Vector2 from '../../../dot/js/Vector2.js';
import Matrix3 from '../../../dot/js/Matrix3.js';
import Vector4 from '../../../dot/js/Vector4.js';

export enum RenderLinearGradientAccuracy {
  SplitAccurate = 0,
  SplitPixelCenter = 2,
  UnsplitCentroid = 3,
  UnsplitPixelCenter = 4
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

    this.logic = logic || new RenderLinearGradientLogic( this.transform, this.start, this.end, this.stops.map( stop => stop.ratio ), this.extend, this.accuracy );
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

    const delta = end.minus( start );
    const normal = delta.timesScalar( 1 / delta.magnitudeSquared );
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

  public readonly inverseTransform: Matrix3;
  private readonly isIdentity: boolean;
  private readonly gradDelta: Vector2;

  public constructor(
    public readonly transform: Matrix3,
    public readonly start: Vector2,
    public readonly end: Vector2,
    public readonly ratios: number[],
    public readonly extend: RenderExtend,
    public readonly accuracy: RenderLinearGradientAccuracy
  ) {
    this.inverseTransform = transform.inverted();
    this.isIdentity = transform.isIdentity();
    this.gradDelta = end.minus( start );
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
