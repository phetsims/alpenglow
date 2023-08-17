// Copyright 2023, University of Colorado Boulder

/**
 * RenderProgram for an image
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { ClippableFace, constantTrue, PolygonalFace, PolygonMitchellNetravali, RenderColor, RenderExtend, RenderImageable, RenderPath, RenderPathProgram, RenderProgram, RenderResampleType, scenery } from '../../../imports.js';
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
        const localPoint = this.inverseTransform.timesVector2( centroid );
        const tx = localPoint.x / this.image.width;
        const ty = localPoint.y / this.image.height;
        const mappedX = RenderImage.extend( this.extendX, tx );
        const mappedY = RenderImage.extend( this.extendY, ty );

        color = this.image.evaluate( Math.floor( mappedX * this.image.width ), Math.floor( mappedY * this.image.height ) );
        return this.colorToLinearPremultiplied( color );
      }
      // Copilot bilinear
      // case RenderResampleType.Bilinear: {
      //   const localPoint = this.inverseTransform.timesVector2( centroid );
      //   const tx = localPoint.x / this.image.width;
      //   const ty = localPoint.y / this.image.height;
      //   const mappedX = RenderImage.extend( this.extendX, tx );
      //   const mappedY = RenderImage.extend( this.extendY, ty );
      //
      //   const x0 = Math.floor( mappedX * this.image.width );
      //   const y0 = Math.floor( mappedY * this.image.height );
      //   const x1 = Math.ceil( mappedX * this.image.width );
      //   const y1 = Math.ceil( mappedY * this.image.height );
      //
      //   const c00 = this.image.evaluate( x0, y0 );
      //   const c10 = this.image.evaluate( x1, y0 );
      //   const c01 = this.image.evaluate( x0, y1 );
      //   const c11 = this.image.evaluate( x1, y1 );
      //
      //   const dx = mappedX * this.image.width - x0;
      //   const dy = mappedY * this.image.height - y0;
      //
      //   color = Vector4.ZERO;
      //   color.x = ( 1 - dx ) * ( 1 - dy ) * c00.x + dx * ( 1 - dy ) * c10.x + ( 1 - dx ) * dy * c01.x + dx * dy * c11.x;
      //   color.y = ( 1 - dx ) * ( 1 - dy ) * c00.y + dx * ( 1 - dy ) * c10.y + ( 1 - dx ) * dy * c01.y + dx * dy * c11.y;
      //   color.z = ( 1 - dx ) * ( 1 - dy ) * c00.z + dx * ( 1 - dy ) * c10.z + ( 1 - dx ) * dy * c01.z + dx * dy * c11.z;
      //   color.w = ( 1 - dx ) * ( 1 - dy ) * c00.w + dx * ( 1 - dy ) * c10.w + ( 1 - dx ) * dy * c01.w + dx * dy * c11.w;
      //   break;
      // }
      case RenderResampleType.AnalyticMitchellNetravali: {
        face = ( face || new PolygonalFace( [ [
          new Vector2( minX, minY ),
          new Vector2( maxX, minY ),
          new Vector2( maxX, maxY ),
          new Vector2( minX, maxY )
        ] ] ) ).toEdgedFace();

        color = Vector4.ZERO.copy();

        // Such that 0,0 now aligns with the center of our 0,0 pixel sample, and is scaled so that pixel samples are
        // at every integer coordinate pair.
        const localFace = face.getTransformed( this.inverseTransformWithHalfOffset );
        // TODO: how to handle... reversing edges if this causes a flip? we might have flipped our orientation.

        const localBounds = localFace.getBounds().roundedOut();
        assert && assert( localBounds.minX < localBounds.maxX );
        assert && assert( localBounds.minY < localBounds.maxY );

        const horizontalSplitValues = _.range( localBounds.minX + 1, localBounds.maxX );
        const verticalSplitValues = _.range( localBounds.minY + 1, localBounds.maxY );
        const horizontalCount = horizontalSplitValues.length + 1;
        const verticalCount = verticalSplitValues.length + 1;

        // TODO: GRID clip, OR even more optimized stripe clips? (or wait... do we not burn much by stripe clipping unused regions?)
        const rows = verticalSplitValues.length ? localFace.getStripeLineClip( Vector2.Y_UNIT, verticalSplitValues, ( minX + maxX ) / 2 ) : [ localFace ];

        // assert && assert( Math.abs( localFace.getArea() - _.sum( rows.map( f => f.getArea() ) ) ) < 1e-6 );

        const areas: number[][] = [];
        const pixelFaces = rows.map( face => {
          const row = horizontalSplitValues.length ? face.getStripeLineClip( Vector2.X_UNIT, horizontalSplitValues, ( minY + maxY ) / 2 ) : [ face ];

          // assert && assert( Math.abs( face.getArea() - _.sum( row.map( f => f.getArea() ) ) ) < 1e-6 );

          areas.push( row.map( face => face.getArea() ) );
          return row;
        } );

        const getPixelFace = ( x: number, y: number ): ClippableFace => {
          const xIndex = x - localBounds.minX;
          const yIndex = y - localBounds.minY;

          assert && assert( xIndex >= 0 && xIndex < horizontalCount && yIndex >= 0 && yIndex < verticalCount );

          return pixelFaces[ yIndex ][ xIndex ];
        };
        const getPixelArea = ( x: number, y: number ): number => {
          const xIndex = x - localBounds.minX;
          const yIndex = y - localBounds.minY;

          if ( xIndex >= 0 && xIndex < horizontalCount && yIndex >= 0 && yIndex < verticalCount ) {
            return areas[ yIndex ][ xIndex ];
          }
          else {
            return 0;
          }
        };

        for ( let y = localBounds.minY - 1; y < localBounds.maxY + 2; y++ ) {
          for ( let x = localBounds.minX - 1; x < localBounds.maxX + 2; x++ ) {
            let contribution = 0;
            for ( let py = y - 2; py < y + 2; py++ ) {
              for ( let px = x - 2; px < x + 2; px++ ) {
                const pixelArea = getPixelArea( px, py );
                if ( pixelArea > 1e-8 ) {
                  if ( pixelArea > 1 - 1e-8 ) {
                    contribution += PolygonMitchellNetravali.evaluateFull( x, y, px, py );
                  }
                  else {
                    const pixelFace = getPixelFace( px, py );
                    const clippedEdges = pixelFace.toEdgedFace().edges; // TODO: optimize this, especially if we are polygonal
                    contribution += PolygonMitchellNetravali.evaluateClippedEdges( clippedEdges, x, y, px, py );
                  }
                }
              }
            }

            if ( contribution > 1e-8 ) {
              const imageColor = this.colorToLinearPremultiplied( this.image.evaluate( x, y ) );
              color.add( imageColor.timesScalar( contribution ) );
            }
          }
        }

        // NOTE: this might flip the sign back to positive of the color (if our transform flipped the orientation)
        color.multiplyScalar( 1 / localFace.getArea() );

        assert && assert( !this.image.isFullyOpaque || color.w >= 1 - 1e-6 );

        // console.log( face.getArea(), area );

        // const totalArea = _.sum( areas.map( _.sum ) );
        //
        // console.log( Math.abs( totalArea - localFace.getArea() ) > 1e-6 );

        return color;
      }
      default:
        throw new Error( 'unknown resample type: ' + this.resampleType );
    }
  }

  public override toRecursiveString( indent: string ): string {
    return `${indent}RenderImage (${this.path ? this.path.id : 'null'})`;
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
