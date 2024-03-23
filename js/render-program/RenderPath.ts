// Copyright 2023-2024, University of Colorado Boulder

/**
 * Represents a path that controls what regions things are drawn in.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, FillRule } from '../imports.js';
import Vector2 from '../../../dot/js/Vector2.js';
import Matrix3 from '../../../dot/js/Matrix3.js';
import Bounds2 from '../../../dot/js/Bounds2.js';

let globalPathId = 0;

export default class RenderPath {

  public readonly id = globalPathId++;

  public constructor( public readonly fillRule: FillRule, public readonly subpaths: Vector2[][] ) {
    assert && subpaths.forEach( subpath => subpath.forEach( point => {
      assert && assert( point.isFinite() );
    } ) );
  }

  public transformed( transform: Matrix3 ): RenderPath {
    return new RenderPath( this.fillRule, this.subpaths.map( subpath => subpath.map( point => transform.timesVector2( point ) ) ) );
  }

  public getBounds(): Bounds2 {
    const bounds = Bounds2.NOTHING.copy();

    for ( let i = 0; i < this.subpaths.length; i++ ) {
      const subpath = this.subpaths[ i ];

      for ( let j = 0; j < subpath.length; j++ ) {
        bounds.addPoint( subpath[ j ] );
      }
    }

    return bounds;
  }

  /**
   * Without scanning the entire path, returns whether we can guarantee that this path is empty and has zero area.
   */
  public isTriviallyEmpty(): boolean {
    // TODO: if we support an inverted fill rule, this logic will need to change!
    return this.subpaths.every( subpath => subpath.length < 3 );
  }

  public serialize(): SerializedRenderPath {
    return {
      fillRule: this.fillRule,
      subpaths: this.subpaths.map( subpath => subpath.map( point => ( { x: point.x, y: point.y } ) ) )
    };
  }

  public static deserialize( obj: SerializedRenderPath ): RenderPath {
    return new RenderPath( obj.fillRule, obj.subpaths.map( subpath => subpath.map( point => new Vector2( point.x, point.y ) ) ) );
  }

  public static fromBounds( bounds: Bounds2 ): RenderPath {
    return new RenderPath( 'nonzero', [
      [
        new Vector2( bounds.minX, bounds.minY ),
        new Vector2( bounds.maxX, bounds.minY ),
        new Vector2( bounds.maxX, bounds.maxY ),
        new Vector2( bounds.minX, bounds.maxY )
      ]
    ] );
  }
}

alpenglow.register( 'RenderPath', RenderPath );

export type SerializedRenderPath = {
  fillRule: FillRule;
  subpaths: { x: number; y: number }[][];
};