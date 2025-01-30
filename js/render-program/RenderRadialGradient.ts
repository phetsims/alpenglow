// Copyright 2023-2024, University of Colorado Boulder

/**
 * RenderProgram for a classic radial gradient.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import Matrix3 from '../../../dot/js/Matrix3.js';
import Vector2 from '../../../dot/js/Vector2.js';
import Vector4 from '../../../dot/js/Vector4.js';
import { alpenglow } from '../alpenglow.js';
import { RenderGradientStop, SerializedRenderGradientStop } from './RenderGradientStop.js';
import { RenderProgram } from './RenderProgram.js';
import { RenderExtend } from './RenderExtend.js';
import type { RenderEvaluationContext } from './RenderEvaluationContext.js';
import { RenderInstruction, RenderInstructionLocation, RenderInstructionReturn } from './RenderInstruction.js';
import { RenderInstructionLinearBlend } from './RenderLinearBlend.js';
import { RenderableFace } from '../raster/RenderableFace.js';
import { RenderLinearRange } from './RenderLinearRange.js';
import type { ClippableFace } from '../cag/ClippableFace.js';
import { RenderColor } from './RenderColor.js';
import { RenderRadialBlend } from './RenderRadialBlend.js';
import { RenderRadialBlendAccuracy } from './RenderRadialBlendAccuracy.js';
import { RenderRadialGradientLogic } from './RenderRadialGradientLogic.js';
import { RenderRadialGradientAccuracy } from './RenderRadialGradientAccuracy.js';
import { RenderInstructionComputeGradientRatio } from './RenderInstructionComputeGradientRatio.js';

alpenglow.register( 'RenderRadialGradientAccuracy', RenderRadialGradientAccuracy );

const toProgram = ( item: RenderGradientStop ): RenderProgram => item.program;

export class RenderRadialGradient extends RenderProgram {

  private logic: RenderRadialGradientLogic;

  public constructor(
    public readonly transform: Matrix3,
    public readonly start: Vector2,
    public readonly startRadius: number,
    public readonly end: Vector2,
    public readonly endRadius: number,
    public readonly stops: RenderGradientStop[], // should be sorted!!
    public readonly extend: RenderExtend,
    public readonly accuracy: RenderRadialGradientAccuracy,
    logic?: RenderRadialGradientLogic
  ) {
    assert && assert( transform.isFinite() );
    assert && assert( start.isFinite() );
    assert && assert( isFinite( startRadius ) && startRadius >= 0 );
    assert && assert( end.isFinite() );
    assert && assert( isFinite( endRadius ) && endRadius >= 0 );

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
      accuracy === RenderRadialGradientAccuracy.UnsplitCentroid || accuracy === RenderRadialGradientAccuracy.SplitCentroid || accuracy === RenderRadialGradientAccuracy.SplitAccurate
    );

    this.logic = logic || RenderRadialGradientLogic.from(
      this.transform,
      this.start,
      this.startRadius,
      this.end,
      this.endRadius,
      this.stops.map( stop => stop.ratio ),
      this.extend,
      this.accuracy
    );
  }

  public override getName(): string {
    return 'RenderRadialGradient';
  }

  public override withChildren( children: RenderProgram[] ): RenderRadialGradient {
    assert && assert( children.length === this.stops.length );
    return new RenderRadialGradient( this.transform, this.start, this.startRadius, this.end, this.endRadius, this.stops.map( ( stop, i ) => {
      return new RenderGradientStop( stop.ratio, children[ i ] );
    } ), this.extend, this.accuracy, this.logic );
  }

  public override isSplittable(): boolean {
    return this.accuracy === RenderRadialGradientAccuracy.SplitAccurate ||
           this.accuracy === RenderRadialGradientAccuracy.SplitCentroid ||
           this.accuracy === RenderRadialGradientAccuracy.SplitPixelCenter;
  }

  public override transformed( transform: Matrix3 ): RenderProgram {
    return new RenderRadialGradient(
      transform.timesMatrix( this.transform ),
      this.start,
      this.startRadius,
      this.end,
      this.endRadius,
      this.stops.map( stop => new RenderGradientStop( stop.ratio, stop.program.transformed( transform ) ) ),
      this.extend,
      this.accuracy
    );
  }

  protected override equalsTyped( other: this ): boolean {
    return this.transform.equals( other.transform ) &&
      this.start.equals( other.start ) &&
      this.startRadius === other.startRadius &&
      this.end.equals( other.end ) &&
      this.endRadius === other.endRadius &&
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

  public getLogic(): RenderRadialGradientLogic {
    return this.logic;
  }

  public override evaluate( context: RenderEvaluationContext ): Vector4 {
    return RenderGradientStop.evaluate( context, this.stops, this.getLogic().computeLinearValue( context ) );
  }

  public override writeInstructions( instructions: RenderInstruction[] ): void {
    const stopLocations = this.stops.map( stop => new RenderInstructionLocation() );
    const blendLocation = new RenderInstructionLocation();

    instructions.push( new RenderInstructionComputeGradientRatio( this.getLogic(), stopLocations, blendLocation ) );
    for ( let i = 0; i < this.stops.length; i++ ) {
      instructions.push( stopLocations[ i ] );
      this.stops[ i ].program.writeInstructions( instructions );
      instructions.push( RenderInstructionReturn.INSTANCE );
    }
    instructions.push( blendLocation );
    instructions.push( RenderInstructionLinearBlend.INSTANCE );
  }

  public override split( face: RenderableFace ): RenderableFace[] {
    const localClippableFace = face.face.getTransformed( this.transform.inverted() );

    const blendAccuracy = this.accuracy === RenderRadialGradientAccuracy.SplitAccurate ? RenderRadialBlendAccuracy.Accurate :
                          this.accuracy === RenderRadialGradientAccuracy.SplitCentroid ? RenderRadialBlendAccuracy.Centroid :
                          RenderRadialBlendAccuracy.PixelCenter;

    const center = this.start;

    const distanceRange = localClippableFace.getDistanceRangeToInside( center );

    const isReversed = this.startRadius > this.endRadius;

    const minRadius = isReversed ? this.endRadius : this.startRadius;
    const maxRadius = isReversed ? this.startRadius : this.endRadius;
    const stops = isReversed ? this.stops.map( stop => {
      return new RenderGradientStop( 1 - stop.ratio, stop.program );
    } ).reverse() : this.stops;

    const deltaRadius = maxRadius - minRadius;
    const offset = minRadius / deltaRadius;

    const radiusToStop = ( radius: number ): number => {
      return ( radius / deltaRadius ) - offset;
    };
    const stopToRadius = ( ratio: number ): number => {
      return ( ratio + offset ) * deltaRadius;
    };

    const min = radiusToStop( distanceRange.min );
    const max = radiusToStop( distanceRange.max );

    const linearRanges = RenderLinearRange.getGradientLinearRanges( min, max, 0, this.extend, stops );

    if ( linearRanges.length < 2 ) {
      // TODO: We should be doing a replacement with a RenderRadialBlend here if possible!
      return [ face ];
    }
    else {
      const splitRadii = linearRanges.map( range => range.start ).slice( 1 ).map( stopToRadius );

      // Compute clippedFaces
      const clippedFaces: ClippableFace[] = [];
      let remainingFace = localClippableFace;
      for ( let i = 0; i < splitRadii.length; i++ ) {
        const splitRadius = splitRadii[ i ];

        // TODO: get maxAngleSplit based on magnitude!!!
        const maxAngleSplit = Math.PI / 64;

        const { insideFace, outsideFace } = remainingFace.getBinaryCircularClip( center, splitRadius, maxAngleSplit );

        clippedFaces.push( insideFace );
        remainingFace = outsideFace;
      }
      clippedFaces.push( remainingFace );

      const blendTransform = this.transform.timesMatrix( Matrix3.translation( center.x, center.y ) );

      const renderableFaces = linearRanges.map( ( range, i ) => {
        const clippedFace = clippedFaces[ i ];

        // NOTE: We need to slightly round things for later parts to work ok.
        // There result in very slight differences between vertex end points without rounding, and that is relevant
        // for the accurate clipping we do later.
        const transformedClippedFace = clippedFace.getTransformed( this.transform ).getRounded( 1e-10 );

        const replacer = ( renderProgram: RenderProgram ): RenderProgram | null => {
          if ( renderProgram !== this ) {
            return null;
          }

          if ( range.startProgram === range.endProgram ) {
            return range.startProgram.replace( replacer );
          }
          else {
            const startRadius = minRadius + range.start * deltaRadius;
            const endRadius = minRadius + range.end * deltaRadius;

            return new RenderRadialBlend(
              blendTransform,
              startRadius,
              endRadius,
              blendAccuracy,
              range.startProgram.replace( replacer ),
              range.endProgram.replace( replacer )
            );
          }
        };

        // TODO: propagate "fake" edge flags
        return new RenderableFace( transformedClippedFace, face.renderProgram.replace( replacer ).simplified(), transformedClippedFace.getBounds() );
      } ).filter( face => face.face.getArea() > 1e-8 );

      return renderableFaces;
    }
  }

  public override serialize(): SerializedRenderRadialGradient {
    return {
      type: 'RenderRadialGradient',
      transform: [
        this.transform.m00(), this.transform.m01(), this.transform.m02(),
        this.transform.m10(), this.transform.m11(), this.transform.m12(),
        this.transform.m20(), this.transform.m21(), this.transform.m22()
      ],
      start: [ this.start.x, this.start.y ],
      startRadius: this.startRadius,
      end: [ this.end.x, this.end.y ],
      endRadius: this.endRadius,
      stops: this.stops.map( stop => stop.serialize() ),
      extend: this.extend,
      accuracy: this.accuracy
    };
  }
}

alpenglow.register( 'RenderRadialGradient', RenderRadialGradient );

export type SerializedRenderRadialGradient = {
  type: 'RenderRadialGradient';
  transform: number[];
  start: number[];
  startRadius: number;
  end: number[];
  endRadius: number;
  stops: SerializedRenderGradientStop[];
  extend: RenderExtend;
  accuracy: RenderRadialGradientAccuracy;
};