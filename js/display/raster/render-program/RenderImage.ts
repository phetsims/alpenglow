// Copyright 2023, University of Colorado Boulder

/**
 * RenderProgram for an image
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { ClippableFace, constantTrue, EdgedFace, LinearEdge, PolygonalFace, PolygonMitchellNetravali, RenderColor, RenderExtend, RenderImageable, RenderPath, RenderPathProgram, RenderProgram, RenderResampleType, scenery } from '../../../imports.js';
import Vector2 from '../../../../../dot/js/Vector2.js';
import Matrix3 from '../../../../../dot/js/Matrix3.js';
import Vector4 from '../../../../../dot/js/Vector4.js';
import Utils from '../../../../../dot/js/Utils.js';
import RenderColorSpace from './RenderColorSpace.js';

export default class RenderImage extends RenderPathProgram {

  public readonly inverseTransform: Matrix3;
  public readonly inverseTransformWithHalfOffset: Matrix3;

  public constructor(
    path: RenderPath | null,
    public readonly transform: Matrix3,
    public readonly image: RenderImageable,
    public readonly extendX: RenderExtend,
    public readonly extendY: RenderExtend,
    public readonly resampleType: RenderResampleType
  ) {
    super( path );

    this.inverseTransform = transform.inverted();
    this.inverseTransformWithHalfOffset = Matrix3.translation( -0.5, -0.5 ).timesMatrix( this.inverseTransform );
  }

  public override transformed( transform: Matrix3 ): RenderProgram {
    return new RenderImage( this.getTransformedPath( transform ), transform.timesMatrix( this.transform ), this.image, this.extendX, this.extendY, this.resampleType );
  }

  public override equals( other: RenderProgram ): boolean {
    if ( this === other ) { return true; }
    return super.equals( other ) &&
      other instanceof RenderImage &&
      this.transform.equals( other.transform ) &&
      this.image === other.image &&
      this.extendX === other.extendX &&
      this.extendY === other.extendY;
  }

  public override isFullyTransparent(): boolean {
    return false;
  }

  public override isFullyOpaque(): boolean {
    return this.path === null && this.image.isFullyOpaque;
  }

  public override replace( callback: ( program: RenderProgram ) => RenderProgram | null ): RenderProgram {
    const replaced = callback( this );
    if ( replaced ) {
      return replaced;
    }
    else {
      return new RenderImage( this.path, this.transform, this.image, this.extendX, this.extendY, this.resampleType );
    }
  }

  public override simplify( pathTest: ( renderPath: RenderPath ) => boolean = constantTrue ): RenderProgram {
    if ( this.isInPath( pathTest ) ) {
      return new RenderImage( null, this.transform, this.image, this.extendX, this.extendY, this.resampleType );
    }
    else {
      return RenderColor.TRANSPARENT;
    }
  }

  private colorToLinearPremultiplied( color: Vector4 ): Vector4 {
    switch( this.image.colorSpace ) {
      case RenderColorSpace.LinearUnpremultipliedSRGB:
        return color;
      case RenderColorSpace.SRGB:
        return RenderColor.premultiply( RenderColor.sRGBToLinear( color ) );
      case RenderColorSpace.Oklab:
        return RenderColor.premultiply( RenderColor.oklabToLinear( color ) );
      default:
        throw new Error( 'unknown color space: ' + this.image.colorSpace );
    }
  }

  public override evaluate(
    face: ClippableFace | null,
    area: number,
    centroid: Vector2,
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
    pathTest: ( renderPath: RenderPath ) => boolean = constantTrue
  ): Vector4 {
    if ( !this.isInPath( pathTest ) ) {
      return Vector4.ZERO;
    }

    // TODO: analytic box! Bilinear! Bicubic! (can we mipmap for those?)
    let color;
    switch( this.resampleType ) {
      case RenderResampleType.NearestNeighbor: {
        const localPoint = this.inverseTransformWithHalfOffset.timesVector2( centroid );
        const tx = localPoint.x / this.image.width;
        const ty = localPoint.y / this.image.height;
        const mappedX = RenderImage.extend( this.extendX, tx );
        const mappedY = RenderImage.extend( this.extendY, ty );
        const roundedX = Utils.roundSymmetric( mappedX * this.image.width );
        const roundedY = Utils.roundSymmetric( mappedY * this.image.height );

        color = this.image.evaluate( roundedX, roundedY );
        return this.colorToLinearPremultiplied( color );
      }
      case RenderResampleType.Bilinear: {
        const localPoint = this.inverseTransformWithHalfOffset.timesVector2( centroid );

        const floorX = Math.floor( localPoint.x );
        const floorY = Math.floor( localPoint.y );
        const ceilX = Math.ceil( localPoint.x );
        const ceilY = Math.ceil( localPoint.y );

        const minX = RenderImage.extendInteger( floorX, this.image.width, this.extendX );
        const minY = RenderImage.extendInteger( floorY, this.image.height, this.extendY );
        const maxX = RenderImage.extendInteger( ceilX, this.image.width, this.extendX );
        const maxY = RenderImage.extendInteger( ceilY, this.image.height, this.extendY );

        const fractionX = localPoint.x - floorX;
        const fractionY = localPoint.y - floorY;

        const a = this.colorToLinearPremultiplied( this.image.evaluate( minX, minY ) );
        const b = this.colorToLinearPremultiplied( this.image.evaluate( minX, maxY ) );
        const c = this.colorToLinearPremultiplied( this.image.evaluate( maxX, minY ) );
        const d = this.colorToLinearPremultiplied( this.image.evaluate( maxX, maxY ) );

        // TODO: allocation reduction?
        const ab = a.timesScalar( 1 - fractionY ).plus( b.timesScalar( fractionY ) );
        const cd = c.timesScalar( 1 - fractionY ).plus( d.timesScalar( fractionY ) );
        return ab.timesScalar( 1 - fractionX ).plus( cd.timesScalar( fractionX ) );
      }
      case RenderResampleType.MitchellNetravali: {
        const localPoint = this.inverseTransformWithHalfOffset.timesVector2( centroid );

        const floorX = Math.floor( localPoint.x );
        const floorY = Math.floor( localPoint.y );

        const x0 = RenderImage.extendInteger( floorX - 1, this.image.width, this.extendX );
        const x1 = RenderImage.extendInteger( floorX, this.image.width, this.extendX );
        const x2 = RenderImage.extendInteger( floorX + 1, this.image.width, this.extendX );
        const x3 = RenderImage.extendInteger( floorX + 2, this.image.width, this.extendX );
        const y0 = RenderImage.extendInteger( floorY - 1, this.image.height, this.extendY );
        const y1 = RenderImage.extendInteger( floorY, this.image.height, this.extendY );
        const y2 = RenderImage.extendInteger( floorY + 1, this.image.height, this.extendY );
        const y3 = RenderImage.extendInteger( floorY + 2, this.image.height, this.extendY );

        const filterX0 = PolygonMitchellNetravali.evaluateFilter( localPoint.x - x0 );
        const filterX1 = PolygonMitchellNetravali.evaluateFilter( localPoint.x - x1 );
        const filterX2 = PolygonMitchellNetravali.evaluateFilter( localPoint.x - x2 );
        const filterX3 = PolygonMitchellNetravali.evaluateFilter( localPoint.x - x3 );
        const filterY0 = PolygonMitchellNetravali.evaluateFilter( localPoint.y - y0 );
        const filterY1 = PolygonMitchellNetravali.evaluateFilter( localPoint.y - y1 );
        const filterY2 = PolygonMitchellNetravali.evaluateFilter( localPoint.y - y2 );
        const filterY3 = PolygonMitchellNetravali.evaluateFilter( localPoint.y - y3 );

        const color = Vector4.ZERO.copy();

        // TODO: allocation reduction?
        color.add( this.colorToLinearPremultiplied( this.image.evaluate( x0, y0 ) ).timesScalar( filterX0 * filterY0 ) );
        color.add( this.colorToLinearPremultiplied( this.image.evaluate( x0, y1 ) ).timesScalar( filterX0 * filterY1 ) );
        color.add( this.colorToLinearPremultiplied( this.image.evaluate( x0, y2 ) ).timesScalar( filterX0 * filterY2 ) );
        color.add( this.colorToLinearPremultiplied( this.image.evaluate( x0, y3 ) ).timesScalar( filterX0 * filterY3 ) );
        color.add( this.colorToLinearPremultiplied( this.image.evaluate( x1, y0 ) ).timesScalar( filterX1 * filterY0 ) );
        color.add( this.colorToLinearPremultiplied( this.image.evaluate( x1, y1 ) ).timesScalar( filterX1 * filterY1 ) );
        color.add( this.colorToLinearPremultiplied( this.image.evaluate( x1, y2 ) ).timesScalar( filterX1 * filterY2 ) );
        color.add( this.colorToLinearPremultiplied( this.image.evaluate( x1, y3 ) ).timesScalar( filterX1 * filterY3 ) );
        color.add( this.colorToLinearPremultiplied( this.image.evaluate( x2, y0 ) ).timesScalar( filterX2 * filterY0 ) );
        color.add( this.colorToLinearPremultiplied( this.image.evaluate( x2, y1 ) ).timesScalar( filterX2 * filterY1 ) );
        color.add( this.colorToLinearPremultiplied( this.image.evaluate( x2, y2 ) ).timesScalar( filterX2 * filterY2 ) );
        color.add( this.colorToLinearPremultiplied( this.image.evaluate( x2, y3 ) ).timesScalar( filterX2 * filterY3 ) );
        color.add( this.colorToLinearPremultiplied( this.image.evaluate( x3, y0 ) ).timesScalar( filterX3 * filterY0 ) );
        color.add( this.colorToLinearPremultiplied( this.image.evaluate( x3, y1 ) ).timesScalar( filterX3 * filterY1 ) );
        color.add( this.colorToLinearPremultiplied( this.image.evaluate( x3, y2 ) ).timesScalar( filterX3 * filterY2 ) );
        color.add( this.colorToLinearPremultiplied( this.image.evaluate( x3, y3 ) ).timesScalar( filterX3 * filterY3 ) );

        return color;
      }
      case RenderResampleType.AnalyticBox: {
        return RenderImage.evaluateAnalyticFilter(
          this, face,
          minX, minY, maxX, maxY,
          this.inverseTransform,
          0, 1, -1,
          ( edges: LinearEdge[], x: number, y: number, px: number, py: number, area: number ) => {
            return area;
          },
          _.constant( 1 )
        );
      }
      case RenderResampleType.AnalyticBilinear: {
        return RenderImage.evaluateAnalyticFilter(
          this, face,
          minX, minY, maxX, maxY,
          this.inverseTransformWithHalfOffset,
          1, 1, 0,
          PolygonMitchellNetravali.evaluateBilinearClippedEdges,
          _.constant( 0.25 )
        );
      }
      case RenderResampleType.AnalyticMitchellNetravali: {
        // TODO: look into separated polygon components to see if we get better precision!
        return RenderImage.evaluateAnalyticFilter(
          this, face,
          minX, minY, maxX, maxY,
          this.inverseTransformWithHalfOffset,
          2, 2, 0,
          PolygonMitchellNetravali.evaluateClippedEdges,
          PolygonMitchellNetravali.evaluateFull
        );
      }
      default:
        throw new Error( 'unknown resample type: ' + this.resampleType );
    }
  }

  public override toRecursiveString( indent: string ): string {
    return `${indent}RenderImage (${this.path ? this.path.id : 'null'})`;
  }

  public static evaluateAnalyticFilter(
    renderImage: RenderImage,
    face: ClippableFace | null,
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
    inverseTransform: Matrix3,
    minExpand: number, // 0 box, 1 bilinear, 2 mitchell
    maxExpand: number, // 1 box, 1 bilinear, 2 mitchell
    boundsShift: number, // -1 for box, 0 for the aligned filters
    evaluateClipped: ( edges: LinearEdge[], x: number, y: number, px: number, py: number, area: number ) => number,
    evaluateFull: ( x: number, y: number, px: number, py: number ) => number
  ): Vector4 {

    const edgedFace = ( face || new PolygonalFace( [ [
      new Vector2( minX, minY ),
      new Vector2( maxX, minY ),
      new Vector2( maxX, maxY ),
      new Vector2( minX, maxY )
    ] ] ) ).toEdgedFace();

    const color = Vector4.ZERO.copy();

    // Such that 0,0 now aligns with the center of our 0,0 pixel sample, and is scaled so that pixel samples are
    // at every integer coordinate pair.
    const localFace = edgedFace.getTransformed( inverseTransform );

    const localBounds = localFace.getBounds().roundedOut();
    assert && assert( localBounds.minX < localBounds.maxX );
    assert && assert( localBounds.minY < localBounds.maxY );

    const horizontalSplitValues = _.range( localBounds.minX + 1, localBounds.maxX );
    const verticalSplitValues = _.range( localBounds.minY + 1, localBounds.maxY );
    const horizontalCount = horizontalSplitValues.length + 1;
    const verticalCount = verticalSplitValues.length + 1;

    // TODO: GRID clip, OR even more optimized stripe clips? (or wait... do we not burn much by stripe clipping unused regions?)
    const rows = verticalSplitValues.length ? localFace.getStripeLineClip( Vector2.Y_UNIT, verticalSplitValues, ( minX + maxX ) / 2 ) : [ localFace ];

    assertSlow && assertSlow( Math.abs( localFace.getArea() - _.sum( rows.map( f => f.getArea() ) ) ) < 1e-6 );

    const areas: number[][] = [];
    const pixelFaces = rows.map( face => {
      const row = horizontalSplitValues.length ? face.getStripeLineClip( Vector2.X_UNIT, horizontalSplitValues, ( minY + maxY ) / 2 ) : [ face ];

      assertSlow && assertSlow( Math.abs( face.getArea() - _.sum( row.map( f => f.getArea() ) ) ) < 1e-6 );

      areas.push( row.map( face => face.getArea() ) );
      return row;
    } );

    const localIndexMin = minExpand + boundsShift + 1;
    const localIndexMax = maxExpand + boundsShift;

    const iterMinX = localBounds.minX - localIndexMin;
    const iterMinY = localBounds.minY - localIndexMin;
    const iterMaxX = localBounds.maxX + localIndexMax;
    const iterMaxY = localBounds.maxY + localIndexMax;

    // box: -0, +0
    // bilinear: 0, +1
    // mitchell: -1, +2
    // TODO: factor out some of these constants
    for ( let y = iterMinY; y < iterMaxY; y++ ) {
      const mappedY = RenderImage.extendInteger( y, renderImage.image.height, renderImage.extendY );

      const subIterMinY = y - minExpand;
      const subIterMaxY = y + maxExpand;

      for ( let x = iterMinX; x < iterMaxX; x++ ) {
        const mappedX = RenderImage.extendInteger( x, renderImage.image.width, renderImage.extendX );
        let contribution = 0;

        const subIterMinX = x - minExpand;
        const subIterMaxX = x + maxExpand;

        // box: -0, +1
        // bilinear: -1, +1
        // mitchell: -2, +2
        for ( let py = subIterMinY; py < subIterMaxY; py++ ) {
          const yIndex = py - localBounds.minY;

          if ( yIndex >= 0 && yIndex < verticalCount ) {
            for ( let px = subIterMinX; px < subIterMaxX; px++ ) {
              const xIndex = px - localBounds.minX;

              if ( xIndex >= 0 && xIndex < horizontalCount ) {
                const pixelArea = areas[ yIndex ][ xIndex ];

                const absPixelArea = Math.abs( pixelArea );
                if ( absPixelArea > 1e-8 ) {
                  if ( absPixelArea > 1 - 1e-8 ) {
                    contribution += Math.sign( pixelArea ) * evaluateFull( x, y, px, py );
                  }
                  else {
                    contribution += evaluateClipped( pixelFaces[ yIndex ][ xIndex ].edges, x, y, px, py, pixelArea );
                  }
                }
              }
            }
          }
        }

        if ( Math.abs( contribution ) > 1e-8 ) {
          const imageColor = renderImage.colorToLinearPremultiplied( renderImage.image.evaluate( mappedX, mappedY ) );
          color.add( imageColor.timesScalar( contribution ) );
        }
      }
    }

    // NOTE: this might flip the sign back to positive of the color (if our transform flipped the orientation)
    if ( renderImage.image.isFullyOpaque ) {
      // Our precision is actually... not great with these equations.
      assert && assert( !renderImage.image.isFullyOpaque || ( color.w / localFace.getArea() >= 1 - 1e-2 ) );

      // We can get an exact alpha here
      color.multiplyScalar( 1 / color.w );
    }
    else {
      color.multiplyScalar( 1 / localFace.getArea() );
    }

    return color;
  }

  public static extend( extend: RenderExtend, t: number ): number {
    switch( extend ) {
      case RenderExtend.Pad:
        return Utils.clamp( t, 0, 1 );
      case RenderExtend.Repeat:
        return t - Math.floor( t );
      case RenderExtend.Reflect:
        return Math.abs( t - 2.0 * Utils.roundSymmetric( 0.5 * t ) );
        // return ( Math.floor( t ) % 2 === 0 ? t : 1 - t ) - Math.floor( t );
      default:
        throw new Error( 'Unknown RenderExtend' );
    }
  }

  // Integer version of extend_mode.
  // Given size=4, provide the following patterns:
  //
  // input:  -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9
  //
  // pad:     0,  0,  0,  0,  0,  0, 0, 1, 2, 3, 3, 3, 3, 3, 3, 3
  // repeat:  2,  3,  0,  1,  2,  3, 0, 1, 2, 3, 0, 1, 2, 3, 0, 1
  // reflect: 2,  3,  3,  2,  1,  0, 0, 1, 2, 3, 3, 2, 1, 0, 0, 1
  public static extendInteger( i: number, size: number, extend: RenderExtend ): number {
    switch( extend ) {
      case RenderExtend.Pad: {
        return Utils.clamp( i, 0, size - 1 );
      }
      case RenderExtend.Repeat: {
        if ( i >= 0 ) {
          return i % size;
        }
        else {
          return size - ( ( -i - 1 ) % size ) - 1;
        }
      }
      case RenderExtend.Reflect: {
        // easier to convert both to positive (with a repeat offset)
        const positiveI = i < 0 ? -i - 1 : i;

        const section = positiveI % ( size * 2 );
        if ( section < size ) {
          return section;
        }
        else {
          return 2 * size - section - 1;
        }
      }
      default: {
        throw new Error( 'Unknown RenderExtend' );
      }
    }
  }
}

scenery.register( 'RenderImage', RenderImage );
