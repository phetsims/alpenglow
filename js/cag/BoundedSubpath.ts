// Copyright 2023-2024, University of Colorado Boulder

/**
 * A single loop of a RenderPath, with computed bounds.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import Bounds2 from '../../../dot/js/Bounds2.js';
import type Vector2 from '../../../dot/js/Vector2.js';
import { alpenglow } from '../alpenglow.js';
import type { RenderPath } from '../render-program/RenderPath.js';

export class BoundedSubpath {

  public readonly bounds: Bounds2;

  public constructor(
    public readonly path: RenderPath,
    public readonly subpath: Vector2[]
  ) {
    this.bounds = Bounds2.NOTHING.copy();

    for ( let i = 0; i < subpath.length; i++ ) {
      this.bounds.addPoint( subpath[ i ] );
    }
  }

  public static fromPathSet( paths: Set<RenderPath> ): BoundedSubpath[] {
    const subpaths: BoundedSubpath[] = [];

    for ( const path of paths ) {
      for ( const subpath of path.subpaths ) {
        subpaths.push( new BoundedSubpath( path, subpath ) );
      }
    }

    return subpaths;
  }
}

alpenglow.register( 'BoundedSubpath', BoundedSubpath );