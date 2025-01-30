// Copyright 2023-2024, University of Colorado Boulder

/**
 * Convert a Node to a RenderProgram
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { isTReadOnlyProperty } from '../../../axon/js/TReadOnlyProperty.js';
import Bounds2 from '../../../dot/js/Bounds2.js';
import Matrix3 from '../../../dot/js/Matrix3.js';
import Vector4 from '../../../dot/js/Vector4.js';
import { Shape } from '../../../kite/js/imports.js';
import ConstructorOf from '../../../phet-core/js/types/ConstructorOf.js';
import IntentionalAny from '../../../phet-core/js/types/IntentionalAny.js';
import { Color, ColorMatrixFilter, Display, Image, LinearGradient, Node, Path, Pattern, RadialGradient, Sprites, TColor, Text, TPaint } from '../../../scenery/js/imports.js';
import { alpenglow } from '../alpenglow.js';
import { CombinedRaster } from '../raster/CombinedRaster.js';
import { Rasterize } from '../raster/Rasterize.js';
import { RenderAlpha } from './RenderAlpha.js';
import { RenderBlendCompose } from './RenderBlendCompose.js';
import { RenderBlendType } from './RenderBlendType.js';
import { RenderColor } from './RenderColor.js';
import { RenderComposeType } from './RenderComposeType.js';
import { RenderExtend } from './RenderExtend.js';
import { RenderGradientStop } from './RenderGradientStop.js';
import { RenderImage } from './RenderImage.js';
import { RenderImageable } from './RenderImageable.js';
import { RenderLinearGradient, RenderLinearGradientAccuracy } from './RenderLinearGradient.js';
import { RenderPath } from './RenderPath.js';
import { RenderPathBoolean } from './RenderPathBoolean.js';
import { RenderProgram } from './RenderProgram.js';
import { RenderRadialGradient, RenderRadialGradientAccuracy } from './RenderRadialGradient.js';
import { RenderResampleType } from './RenderResampleType.js';
import { RenderStack } from './RenderStack.js';
import { RenderPremultiply } from './RenderPremultiply.js';
import { RenderFilter } from './RenderFilter.js';
import { RenderUnpremultiply } from './RenderUnpremultiply.js';

// TODO: better for this?
const piecewiseOptions = {
  minLevels: 1,
  maxLevels: 10,
  // distanceEpsilon: 0.02,
  distanceEpsilon: 0.0002,
  curveEpsilon: 0.2
};

// const resampleType = RenderResampleType.Bilinear;
const resampleType = RenderResampleType.AnalyticBilinear; // TODO: handle mipmapping!

const combine = ( a: RenderProgram, b: RenderProgram ) => new RenderBlendCompose(
  RenderComposeType.Over,
  RenderBlendType.Normal,
  a, b
);

// const boundsToRenderPath = ( bounds: Bounds2 ) => new RenderPath(
//   'nonzero',
//   [
//     [
//       new Vector2( bounds.minX, bounds.minY ),
//       new Vector2( bounds.maxX, bounds.minY ),
//       new Vector2( bounds.maxX, bounds.maxY ),
//       new Vector2( bounds.minX, bounds.maxY )
//     ]
//   ]
// );

const shapeToRenderPath = ( shape: Shape ) => new RenderPath(
  'nonzero',
  shape.subpaths.map( subpath => {
    return subpath.toPiecewiseLinear( piecewiseOptions ).segments.map( line => {
      return line.start;
    } );
  } )
);

const shapesToRenderPath = ( shapes: Shape[] ) => new RenderPath(
  'nonzero',
  shapes.flatMap( shape => shapeToRenderPath( shape ).subpaths )
);

const renderPathPaintToRenderProgram = ( renderPath: RenderPath, paint: TPaint, matrix: Matrix3 ): RenderProgram => {
  if ( isTReadOnlyProperty( paint ) ) {
    paint = paint.value;
  }

  if ( paint === null ) {
    return RenderColor.TRANSPARENT;
  }

  if ( typeof paint === 'string' ) {
    paint = new Color( paint );
  }

  if ( paint instanceof Color ) {
    return RenderPathBoolean.fromInside(
      renderPath,
      new RenderColor( colorFromTColor( paint ) )
    );
  }
  else {
    const paintMatrix = paint.transformMatrix ? matrix.timesMatrix( paint.transformMatrix ) : matrix;
    if ( paint instanceof LinearGradient ) {
      return RenderPathBoolean.fromInside( renderPath, new RenderLinearGradient(
        paintMatrix,
        paint.start,
        paint.end,
        paint.stops.map( stop => {
          return new RenderGradientStop( stop.ratio, new RenderColor( colorFromTColor( stop.color ) ) );
        } ),
        RenderExtend.Pad,
        RenderLinearGradientAccuracy.SplitAccurate
      ) );
    }
    else if ( paint instanceof RadialGradient ) {
      return RenderPathBoolean.fromInside( renderPath, new RenderRadialGradient(
        paintMatrix,
        paint.start,
        paint.startRadius,
        paint.end,
        paint.endRadius,
        paint.stops.map( stop => {
          return new RenderGradientStop( stop.ratio, new RenderColor( colorFromTColor( stop.color ) ) );
        } ),
        RenderExtend.Pad,
        RenderRadialGradientAccuracy.SplitAccurate
      ) );
    }
    else if ( paint instanceof Pattern ) {
      return RenderPathBoolean.fromInside( renderPath, new RenderImage(
        paintMatrix,
        imagelikeToRenderImageable( paint.image ),
        RenderExtend.Repeat,
        RenderExtend.Repeat,
        resampleType
      ) );
    }
  }

  // If unimplemented
  console.log( 'SOME PAINT TYPE UNIMPLEMENTED?!?' );
  return RenderColor.TRANSPARENT;
};

const imagelikeToRenderImageable = ( imagelike: HTMLImageElement | HTMLCanvasElement | ImageBitmap ): RenderImageable => {
  const canvas = document.createElement( 'canvas' );
  canvas.width = imagelike.width;
  canvas.height = imagelike.height;
  const context = canvas.getContext( '2d', {
    willReadFrequently: true
  } )!;
  context.drawImage( imagelike, 0, 0 );

  const imageData = context.getImageData( 0, 0, canvas.width, canvas.height );

  let isFullyOpaque = true;

  const premultipliedData: Vector4[] = [];
  for ( let i = 0; i < imageData.data.length / 4; i++ ) {
    const baseIndex = i * 4;
    const r = imageData.data[ baseIndex ] / 255;
    const g = imageData.data[ baseIndex + 1 ] / 255;
    const b = imageData.data[ baseIndex + 2 ] / 255;
    const a = imageData.data[ baseIndex + 3 ] / 255;
    if ( a < 1 ) {
      isFullyOpaque = false;
    }
    const srgb = new Vector4( r, g, b, a );
    const premultiplied = RenderColor.premultiply( srgb );
    premultipliedData.push( premultiplied );
  }

  // const linearPremultipliedData: Vector4[] = [];
  // for ( let i = 0; i < imageData.data.length / 4; i++ ) {
  //   const baseIndex = i * 4;
  //   const r = imageData.data[ baseIndex ] / 255;
  //   const g = imageData.data[ baseIndex + 1 ] / 255;
  //   const b = imageData.data[ baseIndex + 2 ] / 255;
  //   const a = imageData.data[ baseIndex + 3 ] / 255;
  //   if ( a < 1 ) {
  //     isFullyOpaque = false;
  //   }
  //   const srgb = new Vector4( r, g, b, a );
  //   const linear = RenderColor.sRGBToLinear( srgb );
  //   const premultiplied = RenderColor.premultiply( linear );
  //   linearPremultipliedData.push( premultiplied );
  // }

  return {
    width: imageData.width,
    height: imageData.height,
    isFullyOpaque: isFullyOpaque,
    evaluate: ( x, y ) => {
      return premultipliedData[ y * imageData.width + x ];
    }
  };
};

const colorFromTColor = ( paint: TColor ): Vector4 => {
  if ( isTReadOnlyProperty( paint ) ) {
    paint = paint.value;
  }

  if ( paint === null ) {
    return Vector4.ZERO;
  }

  if ( typeof paint === 'string' ) {
    paint = new Color( paint );
  }

  return RenderColor.premultiply( new Vector4(
    paint.red / 255,
    paint.green / 255,
    paint.blue / 255,
    paint.alpha
  ) );
};

export class RenderFromNode {
  public static nodeToRenderProgram( node: Node, matrix: Matrix3 = Matrix3.IDENTITY ): RenderProgram {

    if ( !node.visible ) {
      return RenderColor.TRANSPARENT;
    }

    const stackPrograms = [];

    if ( node.matrix ) {
      matrix = matrix.timesMatrix( node.matrix );
    }

    if ( node instanceof Path ) {
      const addShape = ( shape: Shape, paint: TPaint ) => {
        const renderPath = shapeToRenderPath( shape.transformed( matrix ) );

        stackPrograms.push( renderPathPaintToRenderProgram( renderPath, paint, matrix ) );
      };

      if ( node.hasShape() ) {
        if ( node.hasFill() ) {
          const shape = node.getShape();
          shape && addShape( shape, node.getFill() );
        }
        if ( node.hasStroke() ) {
          let shape = node.getShape()!;
          if ( node.lineDash.length ) {
            shape = shape.getDashedShape( node.lineDash, node.lineDashOffset );
          }
          shape = shape.getStrokedShape( node._lineDrawingStyles );
          addShape( shape, node.getStroke() );
        }
      }
    }
    else if ( node instanceof Text ) {
      // TODO: Merge in vello-scenery
      // @ts-expect-error We will stub out better font handling in the future
      const font: IntentionalAny = ( node._font.weight === 'bold' ? window.sceneryBoldFont : window.sceneryFont );
      const scale = node._font.numericSize / font.unitsPerEM;
      const sizedMatrix = matrix.timesMatrix( Matrix3.scaling( scale ) );

      const shapedText = font.shapeText( node.renderedText, true );

      // TODO: isolate out if we're using this
      const flipMatrix = Matrix3.rowMajor(
        1, 0, 0,
        0, -1, 0, // vertical flip
        0, 0, 1
      );

      if ( shapedText ) {
        const glyphShapes: Shape[] = [];

        let x = 0;
        // TODO: Merge in vello-scenery
        // @ts-expect-error We will stub out better font handling in the future
        shapedText.forEach( glyph => {
          const glyphMatrix = sizedMatrix.timesMatrix( Matrix3.translation( x + glyph.x, glyph.y ) ).timesMatrix( flipMatrix );

          glyphShapes.push( glyph.shape.transformed( glyphMatrix ) );

          x += glyph.advance;
        } );

        if ( node.hasFill() ) {
          const renderPath = shapesToRenderPath( glyphShapes );
          stackPrograms.push( renderPathPaintToRenderProgram( renderPath, node.getFill(), matrix ) );
        }

        if ( node.hasStroke() ) {
          const renderPath = shapesToRenderPath( glyphShapes.map( shape => {
            if ( node.lineDash.length ) {
              shape = shape.getDashedShape( node.lineDash, node.lineDashOffset );
            }
            return shape.getStrokedShape( node._lineDrawingStyles );
          } ) );
          stackPrograms.push( renderPathPaintToRenderProgram( renderPath, node.getStroke(), matrix ) );
        }
      }
      else {
        console.log( 'TEXT UNSHAPED', node.renderedText );
      }
    }
    else if ( node instanceof Sprites ) {
      // TODO: Sprites
      console.log( 'SPRITES UNIMPLEMENTED' );
    }
    else if ( node instanceof Image ) {

      const nodeImage = node.image;
      if ( nodeImage ) {
        const renderPath = shapeToRenderPath( Shape.bounds( node.selfBounds ).transformed( matrix ) );

        const renderImage = RenderPathBoolean.fromInside( renderPath, new RenderImage(
          matrix,
          imagelikeToRenderImageable( node.image ),
          RenderExtend.Pad,
          RenderExtend.Pad,
          resampleType
        ) );

        stackPrograms.push( node.imageOpacity === 1 ? renderImage : new RenderAlpha( renderImage, node.imageOpacity ) );
      }
    }

    // Children
    node.children.forEach( child => {
      stackPrograms.push( RenderFromNode.nodeToRenderProgram( child, matrix ) );
    } );

    let result: RenderProgram = new RenderStack( stackPrograms ).simplified();

    // Filters are applied before
    node.filters.forEach( filter => {
      if ( filter instanceof ColorMatrixFilter ) {
        // NOTE: Apply them no matter what, we'll rely on later simplified (because filters can take transparent to NOT)

        // TODO: Merge in vello-scenery
        // eslint-disable-next-line @typescript-eslint/prefer-ts-expect-error
        // @ts-ignore We will stub out better font handling in the future
        result = new RenderPremultiply( new RenderFilter( new RenderUnpremultiply( result ), filter.getMatrix(), filter.getTranslation() ) );
      }
    } );

    if ( node.effectiveOpacity !== 1 && !result.isFullyTransparent ) {
      result = new RenderAlpha( result, node.effectiveOpacity );
    }

    if ( node.clipArea && !result.isFullyTransparent ) {
      result = new RenderBlendCompose( RenderComposeType.In, RenderBlendType.Normal, result, new RenderPathBoolean(
        shapeToRenderPath( node.clipArea ),
        new RenderColor( new Vector4( 1, 1, 1, 1 ) ),
        RenderColor.TRANSPARENT
      ) );
    }

    return result.simplified();
  }

  public static addBackgroundColor( renderProgram: RenderProgram, color: Color ): RenderProgram {
    return combine( renderProgram, new RenderColor( colorFromTColor( color ) ) );
  }

  public static showSim(): void {
    const phet = 'phet';
    const display: Display = window[ phet ].joist.display;
    const program = RenderFromNode.addBackgroundColor( RenderFromNode.nodeToRenderProgram( display.rootNode ), Color.toColor( display.backgroundColor ) );
    const sizedProgram = program.transformed( Matrix3.scaling( window.devicePixelRatio ) );
    const width = display.width * window.devicePixelRatio;
    const height = display.height * window.devicePixelRatio;
    const raster = new CombinedRaster( width, height );
    Rasterize.rasterize( sizedProgram, raster, new Bounds2( 0, 0, width, height ) );
    const canvas = Rasterize.imageDataToCanvas( raster.toImageData() );
    canvas.style.width = `${canvas.width / window.devicePixelRatio}px`;
    canvas.style.height = `${canvas.height / window.devicePixelRatio}px`;
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.zIndex = '1000000';
    document.body.appendChild( canvas );
  }

  public static nodeToJSON( node: Node ): string {
    const padding = 5;
    const addBackground = true;
    const pretty = false;
    const scale = 1;

    let program = RenderFromNode.nodeToRenderProgram( node );

    program = program.transformed( Matrix3.scaling( scale ).timesMatrix( Matrix3.translation( padding - node.bounds.minX, padding - node.bounds.minY ) ) );

    if ( addBackground ) {
      program = combine( program, new RenderImage(
        Matrix3.scaling( 5 ),
        {
          width: 2,
          height: 2,
          isFullyOpaque: true,
          evaluate: ( x: number, y: number ) => {
            const value = ( x + y ) % 2 === 0 ? 0.9 : 0.85;
            return new Vector4( value, value, value, 1 );
          }
        },
        RenderExtend.Repeat,
        RenderExtend.Repeat,
        RenderResampleType.NearestNeighbor
      ) );
    }

    const obj = program.simplified().serialize();
    return pretty ? JSON.stringify( obj, null, 2 ) : JSON.stringify( obj );
  }

  public static premultipliedSRGBToColor( premultiplied: Vector4 ): Color {
    const sRGB = RenderColor.unpremultiply( premultiplied );

    return new Color(
      sRGB.x * 255,
      sRGB.y * 255,
      sRGB.z * 255,
      sRGB.w
    );
  }

  public static colorFrom( ...args: ConstructorParameters<ConstructorOf<Color>> ): RenderColor {
    // @ts-expect-error We're passing Color's constructor arguments in
    const color = new Color( ...args );
    return new RenderColor( new Vector4(
      color.red / 255,
      color.green / 255,
      color.blue / 255,
      color.alpha
    ) );
  }
}

alpenglow.register( 'RenderFromNode', RenderFromNode );