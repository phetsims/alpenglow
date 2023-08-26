// Copyright 2023, University of Colorado Boulder

/**
 * RenderProgram for alpha (an opacity) applied to a RenderProgram
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { ClippableFace, constantTrue, RenderColor, RenderPath, RenderProgram, scenery, SerializedRenderProgram } from '../../../imports.js';
import Vector2 from '../../../../../dot/js/Vector2.js';
import Vector4 from '../../../../../dot/js/Vector4.js';

export default class RenderAlpha extends RenderProgram {
  public constructor(
    public readonly program: RenderProgram,
    public readonly alpha: number
  ) {
    super();
  }

  public override getChildren(): RenderProgram[] {
    return [ this.program ];
  }

  public override withChildren( children: RenderProgram[] ): RenderAlpha {
    assert && assert( children.length === 1 );
    return new RenderAlpha( children[ 0 ], this.alpha );
  }

  public override equals( other: RenderProgram ): boolean {
    if ( this === other ) { return true; }
    return other instanceof RenderAlpha &&
           this.program.equals( other.program ) &&
           this.alpha === other.alpha;
  }

  public override replace( callback: ( program: RenderProgram ) => RenderProgram | null ): RenderProgram {
    const replaced = callback( this );
    if ( replaced ) {
      return replaced;
    }
    else {
      return new RenderAlpha( this.program.replace( callback ), this.alpha );
    }
  }

  public override isFullyTransparent(): boolean {
    return this.alpha === 0 || this.program.isFullyTransparent();
  }

  public override isFullyOpaque(): boolean {
    return this.alpha === 1 && this.program.isFullyOpaque();
  }

  public override needsFace(): boolean {
    return this.program.needsFace();
  }

  public override needsArea(): boolean {
    return this.program.needsArea();
  }

  public override needsCentroid(): boolean {
    return this.program.needsCentroid();
  }

  public override simplify( pathTest: ( renderPath: RenderPath ) => boolean = constantTrue ): RenderProgram {
    const program = this.program.simplify( pathTest );

    if ( program.isFullyTransparent() || this.alpha === 0 ) {
      return RenderColor.TRANSPARENT;
    }

    if ( this.alpha === 1 ) {
      return program;
    }

    // Now we're "inside" our path
    if ( program instanceof RenderColor ) {
      return new RenderColor( program.color.timesScalar( this.alpha ) );
    }
    else {
      return new RenderAlpha( program, this.alpha );
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

    return source.timesScalar( this.alpha );
  }

  public override toRecursiveString( indent: string ): string {
    return `${indent}RenderAlpha alpha:${this.alpha})\n` +
           `${this.program.toRecursiveString( indent + '  ' )}`;
  }

  public override serialize(): SerializedRenderAlpha {
    return {
      type: 'RenderAlpha',
      program: this.program.serialize()
    };
  }

  public static override deserialize( obj: SerializedRenderAlpha ): RenderAlpha {
    return new RenderAlpha( RenderProgram.deserialize( obj.program ), 1 );
  }
}

scenery.register( 'RenderAlpha', RenderAlpha );

export type SerializedRenderAlpha = {
  type: 'RenderAlpha';
  program: SerializedRenderProgram;
};
