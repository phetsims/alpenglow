// Copyright 2023, University of Colorado Boulder

/**
 * RenderProgram to convert sRGB => linear sRGB
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { ClippableFace, constantTrue, RenderColor, RenderPath, RenderProgram, scenery, SerializedRenderProgram } from '../../../imports.js';
import Vector2 from '../../../../../dot/js/Vector2.js';
import Vector4 from '../../../../../dot/js/Vector4.js';

export default class RenderSRGBToLinearSRGB extends RenderProgram {
  public constructor(
    public readonly program: RenderProgram
  ) {
    super();
  }

  public override getChildren(): RenderProgram[] {
    return [ this.program ];
  }

  public override withChildren( children: RenderProgram[] ): RenderSRGBToLinearSRGB {
    assert && assert( children.length === 1 );
    return new RenderSRGBToLinearSRGB( children[ 0 ] );
  }

  public override equals( other: RenderProgram ): boolean {
    if ( this === other ) { return true; }
    return other instanceof RenderSRGBToLinearSRGB &&
           this.program.equals( other.program );
  }

  public override replace( callback: ( program: RenderProgram ) => RenderProgram | null ): RenderProgram {
    const replaced = callback( this );
    if ( replaced ) {
      return replaced;
    }
    else {
      return new RenderSRGBToLinearSRGB( this.program.replace( callback ) );
    }
  }

  public override simplify( pathTest: ( renderPath: RenderPath ) => boolean = constantTrue ): RenderProgram {
    const program = this.program.simplify( pathTest );

    if ( program.isFullyTransparent() ) {
      return RenderColor.TRANSPARENT;
    }

    // Now we're "inside" our path
    if ( program instanceof RenderColor ) {
      return new RenderColor( RenderColor.sRGBToLinear( program.color ) );
    }
    else {
      return new RenderSRGBToLinearSRGB( program );
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
    const source = this.program.evaluate( face, area, centroid, minX, minY, maxX, maxY, pathTest );

    return RenderColor.sRGBToLinear( source );
  }

  public override toRecursiveString( indent: string ): string {
    return `${indent}RenderSRGBToLinearSRGB\n` +
           `${this.program.toRecursiveString( indent + '  ' )}`;
  }

  public override serialize(): SerializedRenderSRGBToLinearSRGB {
    return {
      type: 'RenderSRGBToLinearSRGB',
      program: this.program.serialize()
    };
  }

  public static override deserialize( obj: SerializedRenderSRGBToLinearSRGB ): RenderSRGBToLinearSRGB {
    return new RenderSRGBToLinearSRGB( RenderProgram.deserialize( obj.program ) );
  }
}

scenery.register( 'RenderSRGBToLinearSRGB', RenderSRGBToLinearSRGB );

export type SerializedRenderSRGBToLinearSRGB = {
  type: 'RenderSRGBToLinearSRGB';
  program: SerializedRenderProgram;
};
