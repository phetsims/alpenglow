// Copyright 2025, University of Colorado Boulder

/**
 * Deserializes RenderPrograms
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import { RenderAlpha, SerializedRenderAlpha } from './RenderAlpha.js';
import { RenderBarycentricBlend, SerializedRenderBarycentricBlend } from './RenderBarycentricBlend.js';
import { RenderBarycentricPerspectiveBlend, SerializedRenderBarycentricPerspectiveBlend } from './RenderBarycentricPerspectiveBlend.js';
import { RenderBlendCompose, SerializedRenderBlendCompose } from './RenderBlendCompose.js';
import { RenderColor, SerializedRenderColor } from './RenderColor.js';
import { RenderColorSpaceConversion, SerializedRenderColorSpaceConversion } from './RenderColorSpaceConversion.js';
import { RenderDepthSort, SerializedRenderDepthSort } from './RenderDepthSort.js';
import { RenderFilter, SerializedRenderFilter } from './RenderFilter.js';
import { RenderImage, SerializedRenderImage } from './RenderImage.js';
import { RenderLinearBlend, SerializedRenderLinearBlend } from './RenderLinearBlend.js';
import { RenderLinearGradient, SerializedRenderLinearGradient } from './RenderLinearGradient.js';
import { RenderNormalDebug, SerializedRenderNormalDebug } from './RenderNormalDebug.js';
import { RenderNormalize, SerializedRenderNormalize } from './RenderNormalize.js';
import { RenderPathBoolean, SerializedRenderPathBoolean } from './RenderPathBoolean.js';
import { RenderPhong, SerializedRenderPhong } from './RenderPhong.js';
import { RenderRadialBlend, SerializedRenderRadialBlend } from './RenderRadialBlend.js';
import { RenderRadialGradient, SerializedRenderRadialGradient } from './RenderRadialGradient.js';
import { RenderStack, SerializedRenderStack } from './RenderStack.js';
import { RenderProgram, SerializedRenderProgram } from './RenderProgram.js';
import Vector2 from '../../../dot/js/Vector2.js';
import Vector3 from '../../../dot/js/Vector3.js';
import { RenderPremultiply } from './RenderPremultiply.js';
import { RenderUnpremultiply } from './RenderUnpremultiply.js';
import { RenderLinearSRGBToOklab } from './RenderLinearSRGBToOklab.js';
import { RenderOklabToLinearSRGB } from './RenderOklabToLinearSRGB.js';
import { RenderSRGBToLinearSRGB } from './RenderSRGBToLinearSRGB.js';
import { RenderLinearDisplayP3ToLinearSRGB } from './RenderLinearDisplayP3ToLinearSRGB.js';
import { RenderLinearSRGBToLinearDisplayP3 } from './RenderLinearSRGBToLinearDisplayP3.js';
import { RenderLinearSRGBToSRGB } from './RenderLinearSRGBToSRGB.js';
import { RenderPlanar } from './RenderPlanar.js';
import Matrix4 from '../../../dot/js/Matrix4.js';
import Vector4 from '../../../dot/js/Vector4.js';
import { RenderGradientStop, SerializedRenderGradientStop } from './RenderGradientStop.js';
import Matrix3 from '../../../dot/js/Matrix3.js';
import { RenderPath } from './RenderPath.js';
import { alpenglow } from '../alpenglow.js';

export const deserializeRenderProgram = ( obj: SerializedRenderProgram ): RenderProgram => {
  if ( obj.type === 'RenderStack' ) {
    return deserializeRenderStack( obj as SerializedRenderStack );
  }
  else if ( obj.type === 'RenderColor' ) {
    return deserializeRenderColor( obj as SerializedRenderColor );
  }
  else if ( obj.type === 'RenderAlpha' ) {
    return deserializeRenderAlpha( obj as SerializedRenderAlpha );
  }
  else if ( obj.type === 'RenderDepthSort' ) {
    return deserializeRenderDepthSort( obj as SerializedRenderDepthSort );
  }
  else if ( obj.type === 'RenderBlendCompose' ) {
    return deserializeRenderBlendCompose( obj as SerializedRenderBlendCompose );
  }
  else if ( obj.type === 'RenderPathBoolean' ) {
    return deserializeRenderPathBoolean( obj as SerializedRenderPathBoolean );
  }
  else if ( obj.type === 'RenderFilter' ) {
    return deserializeRenderFilter( obj as SerializedRenderFilter );
  }
  else if ( obj.type === 'RenderImage' ) {
    return deserializeRenderImage( obj as SerializedRenderImage );
  }
  else if ( obj.type === 'RenderNormalize' ) {
    return deserializeRenderNormalize( obj as SerializedRenderNormalize );
  }
  else if ( obj.type === 'RenderLinearBlend' ) {
    return deserializeRenderLinearBlend( obj as SerializedRenderLinearBlend );
  }
  else if ( obj.type === 'RenderBarycentricBlend' ) {
    return deserializeRenderBarycentricBlend( obj as SerializedRenderBarycentricBlend );
  }
  else if ( obj.type === 'RenderBarycentricPerspectiveBlend' ) {
    return deserializeRenderBarycentricPerspectiveBlend( obj as SerializedRenderBarycentricPerspectiveBlend );
  }
  else if ( obj.type === 'RenderLinearGradient' ) {
    return deserializeRenderLinearGradient( obj as SerializedRenderLinearGradient );
  }
  else if ( obj.type === 'RenderRadialBlend' ) {
    return deserializeRenderRadialBlend( obj as SerializedRenderRadialBlend );
  }
  else if ( obj.type === 'RenderRadialGradient' ) {
    return deserializeRenderRadialGradient( obj as SerializedRenderRadialGradient );
  }
  else if ( obj.type === 'RenderColorSpaceConversion' ) {
    return deserializeRenderColorSpaceConversion( obj as SerializedRenderColorSpaceConversion );
  }
  else if ( obj.type === 'RenderPhong' ) {
    return deserializeRenderPhong( obj as SerializedRenderPhong );
  }
  else if ( obj.type === 'RenderNormalDebug' ) {
    return deserializeRenderNormalDebug( obj as SerializedRenderNormalDebug );
  }

  throw new Error( `Unrecognized RenderProgram type: ${obj.type}` );
};
alpenglow.register( 'deserializeRenderProgram', deserializeRenderProgram );

export const deserializeRenderAlpha = ( obj: SerializedRenderAlpha ): RenderAlpha => {
  return new RenderAlpha( deserializeRenderProgram( obj.program ), obj.alpha );
};

export const deserializeRenderBarycentricBlend = ( obj: SerializedRenderBarycentricBlend ): RenderBarycentricBlend => {
  return new RenderBarycentricBlend(
    new Vector2( obj.pointA[ 0 ], obj.pointA[ 1 ] ),
    new Vector2( obj.pointB[ 0 ], obj.pointB[ 1 ] ),
    new Vector2( obj.pointC[ 0 ], obj.pointC[ 1 ] ),
    obj.accuracy,
    deserializeRenderProgram( obj.a ),
    deserializeRenderProgram( obj.b ),
    deserializeRenderProgram( obj.c )
  );
};

export const deserializeRenderBarycentricPerspectiveBlend = ( obj: SerializedRenderBarycentricPerspectiveBlend ): RenderBarycentricPerspectiveBlend => {
  return new RenderBarycentricPerspectiveBlend(
    new Vector3( obj.pointA[ 0 ], obj.pointA[ 1 ], obj.pointA[ 2 ] ),
    new Vector3( obj.pointB[ 0 ], obj.pointB[ 1 ], obj.pointB[ 2 ] ),
    new Vector3( obj.pointC[ 0 ], obj.pointC[ 1 ], obj.pointC[ 2 ] ),
    obj.accuracy,
    deserializeRenderProgram( obj.a ),
    deserializeRenderProgram( obj.b ),
    deserializeRenderProgram( obj.c )
  );
};

export const deserializeRenderBlendCompose = ( obj: SerializedRenderBlendCompose ): RenderBlendCompose => {
  return new RenderBlendCompose( obj.composeType, obj.blendType, deserializeRenderProgram( obj.a ), deserializeRenderProgram( obj.b ) );
};

export const deserializeRenderColorSpaceConversion = ( obj: SerializedRenderColorSpaceConversion ): RenderColorSpaceConversion => {
  const program = deserializeRenderProgram( obj.program );

  if ( obj.subtype === 'RenderPremultiply' ) {
    return new RenderPremultiply( program );
  }
  else if ( obj.subtype === 'RenderUnpremultiply' ) {
    return new RenderUnpremultiply( program );
  }
  else if ( obj.subtype === 'RenderLinearSRGBToOklab' ) {
    return new RenderLinearSRGBToOklab( program );
  }
  else if ( obj.subtype === 'RenderLinearSRGBToSRGB' ) {
    return new RenderLinearSRGBToSRGB( program );
  }
  else if ( obj.subtype === 'RenderOklabToLinearSRGB' ) {
    return new RenderOklabToLinearSRGB( program );
  }
  else if ( obj.subtype === 'RenderSRGBToLinearSRGB' ) {
    return new RenderSRGBToLinearSRGB( program );
  }
  else if ( obj.subtype === 'RenderLinearDisplayP3ToLinearSRGB' ) {
    return new RenderLinearDisplayP3ToLinearSRGB( program );
  }
  else if ( obj.subtype === 'RenderLinearSRGBToLinearDisplayP3' ) {
    return new RenderLinearSRGBToLinearDisplayP3( program );
  }
  else {
    throw new Error( `Unrecognized subtype: ${obj.subtype}` );
  }
};

export const deserializeRenderDepthSort = ( obj: SerializedRenderDepthSort ): RenderDepthSort => {
  return new RenderDepthSort( obj.items.map( item => new RenderPlanar(
    deserializeRenderProgram( item.program ),
    new Vector3( item.pointA[ 0 ], item.pointA[ 1 ], item.pointA[ 2 ] ),
    new Vector3( item.pointB[ 0 ], item.pointB[ 1 ], item.pointB[ 2 ] ),
    new Vector3( item.pointC[ 0 ], item.pointC[ 1 ], item.pointC[ 2 ]
  ) ) ) );
};

export const deserializeRenderFilter = ( obj: SerializedRenderFilter ): RenderFilter => {
  return new RenderFilter(
    deserializeRenderProgram( obj.program ),
    new Matrix4( ...obj.colorMatrix ),
    new Vector4( obj.colorTranslation[ 0 ], obj.colorTranslation[ 1 ], obj.colorTranslation[ 2 ], obj.colorTranslation[ 3 ] )
  );
};

export const deserializeRenderGradientStop = ( obj: SerializedRenderGradientStop ): RenderGradientStop => {
  return new RenderGradientStop( obj.ratio, deserializeRenderProgram( obj.program ) );
};

export const deserializeRenderRadialGradient = ( obj: SerializedRenderRadialGradient ): RenderRadialGradient => {
  return new RenderRadialGradient(
    Matrix3.rowMajor(
      obj.transform[ 0 ], obj.transform[ 1 ], obj.transform[ 2 ],
      obj.transform[ 3 ], obj.transform[ 4 ], obj.transform[ 5 ],
      obj.transform[ 6 ], obj.transform[ 7 ], obj.transform[ 8 ]
    ),
    new Vector2( obj.start[ 0 ], obj.start[ 1 ] ),
    obj.startRadius,
    new Vector2( obj.end[ 0 ], obj.end[ 1 ] ),
    obj.endRadius,
    obj.stops.map( stop => deserializeRenderGradientStop( stop ) ),
    obj.extend,
    obj.accuracy
  );
};

export const deserializeRenderLinearGradient = ( obj: SerializedRenderLinearGradient ): RenderLinearGradient => {
  return new RenderLinearGradient(
    Matrix3.rowMajor(
      obj.transform[ 0 ], obj.transform[ 1 ], obj.transform[ 2 ],
      obj.transform[ 3 ], obj.transform[ 4 ], obj.transform[ 5 ],
      obj.transform[ 6 ], obj.transform[ 7 ], obj.transform[ 8 ]
    ),
    new Vector2( obj.start[ 0 ], obj.start[ 1 ] ),
    new Vector2( obj.end[ 0 ], obj.end[ 1 ] ),
    obj.stops.map( stop => deserializeRenderGradientStop( stop ) ),
    obj.extend,
    obj.accuracy
  );
};

export const deserializeRenderStack = ( obj: SerializedRenderStack ): RenderStack => {
  return new RenderStack( obj.children.map( child => deserializeRenderProgram( child ) ) );
};


export const deserializeRenderColor = ( obj: SerializedRenderColor ): RenderColor => {
  return new RenderColor( new Vector4( obj.color.r, obj.color.g, obj.color.b, obj.color.a ) );
};

export const deserializeRenderPathBoolean = ( obj: SerializedRenderPathBoolean ): RenderPathBoolean => {
  return new RenderPathBoolean( RenderPath.deserialize( obj.path ), deserializeRenderProgram( obj.inside ), deserializeRenderProgram( obj.outside ) );
};

export const deserializeRenderImage = ( obj: SerializedRenderImage ): RenderImage => {
  return new RenderImage(
    Matrix3.rowMajor(
      obj.transform[ 0 ], obj.transform[ 1 ], obj.transform[ 2 ],
      obj.transform[ 3 ], obj.transform[ 4 ], obj.transform[ 5 ],
      obj.transform[ 6 ], obj.transform[ 7 ], obj.transform[ 8 ]
    ),
    RenderImage.deserializeRenderImageable( obj.image ),
    obj.extendX,
    obj.extendY,
    obj.resampleType
  );
};

export const deserializeRenderNormalize = ( obj: SerializedRenderNormalize ): RenderNormalize => {
  return new RenderNormalize( deserializeRenderProgram( obj.program ) );
};

export const deserializeRenderLinearBlend = ( obj: SerializedRenderLinearBlend ): RenderLinearBlend => {
  return new RenderLinearBlend(
    new Vector2( obj.scaledNormal[ 0 ], obj.scaledNormal[ 1 ] ),
    obj.offset,
    obj.accuracy,
    deserializeRenderProgram( obj.zero ),
    deserializeRenderProgram( obj.one )
  );
};

export const deserializeRenderRadialBlend = ( obj: SerializedRenderRadialBlend ): RenderRadialBlend => {
  return new RenderRadialBlend(
    Matrix3.rowMajor(
      obj.transform[ 0 ], obj.transform[ 1 ], obj.transform[ 2 ],
      obj.transform[ 3 ], obj.transform[ 4 ], obj.transform[ 5 ],
      obj.transform[ 6 ], obj.transform[ 7 ], obj.transform[ 8 ]
    ),
    obj.radius0,
    obj.radius1,
    obj.accuracy,
    deserializeRenderProgram( obj.zero ),
    deserializeRenderProgram( obj.one )
  );
};

export const deserializeRenderPhong = ( obj: SerializedRenderPhong ): RenderPhong => {
  // @ts-expect-error
  return new RenderPhong( obj.alpha, ...obj.children.map( deserializeRenderProgram ) );
};

export const deserializeRenderNormalDebug = ( obj: SerializedRenderNormalDebug ): RenderNormalDebug => {
  return new RenderNormalDebug( deserializeRenderProgram( obj.normalProgram ) );
};