// Copyright 2023, University of Colorado Boulder

/**
 * RenderProgram for applying a color-matrix filter
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { ClippableFace, constantTrue, RenderColor, RenderPath, RenderPathProgram, RenderProgram, scenery, SerializedRenderPath, SerializedRenderProgram } from '../../../imports.js';
import Vector2 from '../../../../../dot/js/Vector2.js';
import Matrix4 from '../../../../../dot/js/Matrix4.js';
import Matrix3 from '../../../../../dot/js/Matrix3.js';
import Vector4 from '../../../../../dot/js/Vector4.js';

export default class RenderFilter extends RenderPathProgram {
  public constructor(
    path: RenderPath | null,
    public readonly program: RenderProgram,
    public readonly colorMatrix: Matrix4,
    public readonly colorTranslation: Vector4
  ) {
    super( path );
  }

  public override transformed( transform: Matrix3 ): RenderProgram {
    return new RenderFilter( this.getTransformedPath( transform ), this.program.transformed( transform ), this.colorMatrix, this.colorTranslation );
  }

  public override equals( other: RenderProgram ): boolean {
    if ( this === other ) { return true; }
    return super.equals( other ) &&
           other instanceof RenderFilter &&
           this.program.equals( other.program ) &&
           this.colorMatrix.equals( other.colorMatrix ) &&
           this.colorTranslation.equals( other.colorTranslation );
  }

  public override replace( callback: ( program: RenderProgram ) => RenderProgram | null ): RenderProgram {
    const replaced = callback( this );
    if ( replaced ) {
      return replaced;
    }
    else {
      return new RenderFilter( this.path, this.program.replace( callback ), this.colorMatrix, this.colorTranslation );
    }
  }

  public override depthFirst( callback: ( program: RenderProgram ) => void ): void {
    this.program.depthFirst( callback );
    callback( this );
  }

  // TODO: inspect colorMatrix to see when it will maintain transparency!
  public override simplify( pathTest: ( renderPath: RenderPath ) => boolean = constantTrue ): RenderProgram {
    const program = this.program.simplify( pathTest );

    if ( this.isInPath( pathTest ) ) {
      if ( program instanceof RenderColor ) {
        return new RenderColor( null, RenderColor.premultiply( this.colorMatrix.timesVector4( RenderColor.unpremultiply( program.color ) ) ) );
      }
      else {
        return new RenderFilter( this.path, program, this.colorMatrix, this.colorTranslation );
      }
    }
    else {
      return program;
    }
  }

  public override isFullyTransparent(): boolean {
    // TODO: colorMatrix check. Homogeneous?
    return false;
  }

  public override isFullyOpaque(): boolean {
    // TODO: colorMatrix check. Homogeneous?
    return false;
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
    const source = this.program.evaluate( face, area, centroid, minX, minY, maxX, maxY, pathTest );

    if ( this.isInPath( pathTest ) ) {
      return RenderColor.premultiply( this.colorMatrix.timesVector4( RenderColor.unpremultiply( source ) ).plus( this.colorTranslation ) );
    }
    else {
      return source;
    }
  }

  public override toRecursiveString( indent: string ): string {
    return `${indent}RenderFilter (${this.path ? this.path.id : 'null'})\n` +
           `${this.program.toRecursiveString( indent + '  ' )}`;
  }

  public override serialize(): SerializedRenderFilter {
    return {
      type: 'RenderFilter',
      path: this.path ? this.path.serialize() : null,
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
      obj.path ? RenderPath.deserialize( obj.path ) : null,
      RenderProgram.deserialize( obj.program ),
      new Matrix4( ...obj.colorMatrix ),
      new Vector4( obj.colorTranslation[ 0 ], obj.colorTranslation[ 1 ], obj.colorTranslation[ 2 ], obj.colorTranslation[ 3 ] )
    );
  }
}

scenery.register( 'RenderFilter', RenderFilter );

export type SerializedRenderFilter = {
  type: 'RenderFilter';
  path: SerializedRenderPath | null;
  program: SerializedRenderProgram;
  colorMatrix: number[];
  colorTranslation: number[];
};