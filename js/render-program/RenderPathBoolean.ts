// Copyright 2023-2024, University of Colorado Boulder

/**
 * RenderPathBoolean will display one RenderProgram "inside" the path, and another RenderProgram "outside" the path.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import Matrix3 from '../../../dot/js/Matrix3.js';
import Vector4 from '../../../dot/js/Vector4.js';
import { alpenglow } from '../alpenglow.js';
import { RenderProgram, SerializedRenderProgram } from './RenderProgram.js';
import { RenderPath, SerializedRenderPath } from './RenderPath.js';
import type { RenderEvaluationContext } from './RenderEvaluationContext.js';
import { isWindingIncluded } from './FillRule.js';
import { RenderColor } from './RenderColor.js';
import { LinearEdge } from '../cag/LinearEdge.js';

export class RenderPathBoolean extends RenderProgram {
  public constructor(
    public readonly path: RenderPath,
    public readonly inside: RenderProgram,
    public readonly outside: RenderProgram
  ) {
    super(
      [ inside, outside ],
      inside.isFullyTransparent && outside.isFullyTransparent,
      inside.isFullyOpaque && outside.isFullyOpaque,
      false,
      false,
      true,
      // We'll use the centroid as the point for determining whether we are on the interior of our path
      true // isPathBoolean
    );
  }

  public override getName(): string {
    return 'RenderPathBoolean';
  }

  public override withChildren( children: RenderProgram[] ): RenderPathBoolean {
    assert && assert( children.length === 2 );
    return new RenderPathBoolean( this.path, children[ 0 ], children[ 1 ] );
  }

  public override transformed( transform: Matrix3 ): RenderProgram {
    return new RenderPathBoolean( this.path.transformed( transform ), this.inside.transformed( transform ), this.outside.transformed( transform ) );
  }

  protected override equalsTyped( other: this ): boolean {
    return this.path === other.path;
  }

  public isOneSided(): boolean {
    return this.outside.isFullyTransparent || this.inside.isFullyTransparent;
  }

  public getOneSide(): RenderProgram {
    assert && assert( this.isOneSided() );

    return this.outside.isFullyTransparent ? this.inside : this.outside;
  }

  public withOneSide( program: RenderProgram ): RenderProgram {
    assert && assert( this.isOneSided() );

    return this.outside.isFullyTransparent ?
           new RenderPathBoolean( this.path, program, this.outside ) :
           new RenderPathBoolean( this.path, this.inside, program );
  }

  protected override getSimplified( children: RenderProgram[] ): RenderProgram | null {
    const inside = children[ 0 ];
    const outside = children[ 1 ];

    if ( inside.isFullyTransparent && outside.isFullyTransparent ) {
      return RenderColor.TRANSPARENT;
    }
    else if ( inside.equals( outside ) ) {
      return inside;
    }
    else if ( this.path.isTriviallyEmpty() ) {
      // NOTE: We're not checking to see if there is zero area, because of the performance impact. This is unlikely to
      // significantly help performance if we check area, so it's not worth it.
      return outside;
    }
    else {
      return null;
    }
  }

  public override evaluate( context: RenderEvaluationContext ): Vector4 {
    assert && assert( context.hasCentroid() );

    // TODO: ACTUALLY, we should clip the face with our path....
    const windingNumber = LinearEdge.getWindingNumberPolygons( this.path.subpaths, context.centroid );
    const included = isWindingIncluded( windingNumber, this.path.fillRule );

    return ( included ? this.inside : this.outside ).evaluate( context );
  }

  protected override getExtraDebugString(): string {
    return `${this.path.id}`;
  }

  public override serialize(): SerializedRenderPathBoolean {
    return {
      type: 'RenderPathBoolean',
      path: this.path.serialize(),
      inside: this.inside.serialize(),
      outside: this.outside.serialize()
    };
  }

  public static fromInside( path: RenderPath, inside: RenderProgram ): RenderPathBoolean {
    return new RenderPathBoolean( path, inside, RenderColor.TRANSPARENT );
  }
}

alpenglow.register( 'RenderPathBoolean', RenderPathBoolean );

export type SerializedRenderPathBoolean = {
  type: 'RenderPathBoolean';
  path: SerializedRenderPath;
  inside: SerializedRenderProgram;
  outside: SerializedRenderProgram;
};