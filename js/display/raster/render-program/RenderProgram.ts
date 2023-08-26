// Copyright 2023, University of Colorado Boulder

/**
 * Represents an abstract rendering program, that may be location-varying
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { ClippableFace, PolygonalFace, RenderAlpha, RenderBlendCompose, RenderColor, RenderFilter, RenderImage, RenderLinearBlend, RenderLinearGradient, RenderLinearSRGBToOklab, RenderLinearSRGBToSRGB, RenderOklabToLinearSRGB, RenderPath, RenderPathBoolean, RenderPremultiply, RenderProgramNeeds, RenderRadialBlend, RenderRadialGradient, RenderSRGBToLinearSRGB, RenderUnpremultiply, scenery, SerializedRenderAlpha, SerializedRenderBlendCompose, SerializedRenderColor, SerializedRenderFilter, SerializedRenderImage, SerializedRenderLinearBlend, SerializedRenderLinearGradient, SerializedRenderLinearSRGBToOklab, SerializedRenderLinearSRGBToSRGB, SerializedRenderOklabToLinearSRGB, SerializedRenderPathBoolean, SerializedRenderPremultiply, SerializedRenderRadialBlend, SerializedRenderRadialGradient, SerializedRenderSRGBToLinearSRGB, SerializedRenderUnpremultiply } from '../../../imports.js';
import Vector2 from '../../../../../dot/js/Vector2.js';
import Matrix3 from '../../../../../dot/js/Matrix3.js';
import Vector4 from '../../../../../dot/js/Vector4.js';

export default abstract class RenderProgram {
  public abstract getChildren(): RenderProgram[];
  public abstract withChildren( children: RenderProgram[] ): RenderProgram;

  public abstract isFullyTransparent(): boolean;
  public abstract isFullyOpaque(): boolean;

  // Stated needs for the program to be evaluated. If it's not needed, we can give bonus info to the program.
  public abstract needsFace(): boolean;
  public abstract needsArea(): boolean;
  public abstract needsCentroid(): boolean;

  public abstract simplify( pathTest?: ( renderPath: RenderPath ) => boolean ): RenderProgram;

  // Premultiplied linear RGB, ignoring the path
  public abstract evaluate(
    face: ClippableFace | null, // if null, it is fully covered
    area: number,
    centroid: Vector2,
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
    pathTest?: ( renderPath: RenderPath ) => boolean
  ): Vector4;

  public abstract toRecursiveString( indent: string ): string;

  public abstract equals( other: RenderProgram ): boolean;

  public abstract replace( callback: ( program: RenderProgram ) => RenderProgram | null ): RenderProgram;

  /**
   * Returns a new RenderProgram with the given transform applied to it.
   *
   * NOTE: Default implementation, should be overridden by subclasses that have positioning information embedded inside
   */
  public transformed( transform: Matrix3 ): RenderProgram {
    return this.withChildren( this.getChildren().map( child => child.transformed( transform ) ) );
  }

  public depthFirst( callback: ( program: RenderProgram ) => void ): void {
    this.getChildren().forEach( child => child.depthFirst( callback ) );
    callback( this );
  }

  public getNeeds(): RenderProgramNeeds {
    return new RenderProgramNeeds( this.needsFace(), this.needsArea(), this.needsCentroid() );
  }

  public abstract serialize(): SerializedRenderProgram;

  public static deserialize( obj: SerializedRenderProgram ): RenderProgram {
    if ( obj.type === 'RenderAlpha' ) {
      return RenderAlpha.deserialize( obj as SerializedRenderAlpha );
    }
    else if ( obj.type === 'RenderBlendCompose' ) {
      return RenderBlendCompose.deserialize( obj as SerializedRenderBlendCompose );
    }
    else if ( obj.type === 'RenderColor' ) {
      return RenderColor.deserialize( obj as SerializedRenderColor );
    }
    else if ( obj.type === 'RenderPathBoolean' ) {
      return RenderPathBoolean.deserialize( obj as SerializedRenderPathBoolean );
    }
    else if ( obj.type === 'RenderFilter' ) {
      return RenderFilter.deserialize( obj as SerializedRenderFilter );
    }
    else if ( obj.type === 'RenderImage' ) {
      return RenderImage.deserialize( obj as SerializedRenderImage );
    }
    else if ( obj.type === 'RenderLinearBlend' ) {
      return RenderLinearBlend.deserialize( obj as SerializedRenderLinearBlend );
    }
    else if ( obj.type === 'RenderLinearGradient' ) {
      return RenderLinearGradient.deserialize( obj as SerializedRenderLinearGradient );
    }
    else if ( obj.type === 'RenderRadialBlend' ) {
      return RenderRadialBlend.deserialize( obj as SerializedRenderRadialBlend );
    }
    else if ( obj.type === 'RenderRadialGradient' ) {
      return RenderRadialGradient.deserialize( obj as SerializedRenderRadialGradient );
    }
    else if ( obj.type === 'RenderPremultiply' ) {
      return RenderPremultiply.deserialize( obj as SerializedRenderPremultiply );
    }
    else if ( obj.type === 'RenderUnpremultiply' ) {
      return RenderUnpremultiply.deserialize( obj as SerializedRenderUnpremultiply );
    }
    else if ( obj.type === 'RenderLinearSRGBToOklab' ) {
      return RenderLinearSRGBToOklab.deserialize( obj as SerializedRenderLinearSRGBToOklab );
    }
    else if ( obj.type === 'RenderLinearSRGBToSRGB' ) {
      return RenderLinearSRGBToSRGB.deserialize( obj as SerializedRenderLinearSRGBToSRGB );
    }
    else if ( obj.type === 'RenderOklabToLinearSRGB' ) {
      return RenderOklabToLinearSRGB.deserialize( obj as SerializedRenderOklabToLinearSRGB );
    }
    else if ( obj.type === 'RenderSRGBToLinearSRGB' ) {
      return RenderSRGBToLinearSRGB.deserialize( obj as SerializedRenderSRGBToLinearSRGB );
    }

    throw new Error( `Unrecognized RenderProgram type: ${obj.type}` );
  }

  public static ensureFace( face: ClippableFace | null, minX: number, minY: number, maxX: number, maxY: number ): ClippableFace {
    return face || PolygonalFace.fromBoundsValues( minX, minY, maxX, maxY );
  }

  public static ensureCentroid( face: ClippableFace | null, area: number, minX: number, minY: number, maxX: number, maxY: number ): Vector2 {
    return face ? face.getCentroid( area ) : new Vector2( ( minX + maxX ) / 2, ( minY + maxY ) / 2 );
  }
}

scenery.register( 'RenderProgram', RenderProgram );

export type SerializedRenderProgram = {
  type: string;
};
