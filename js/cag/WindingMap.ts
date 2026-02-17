// Copyright 2023-2025, University of Colorado Boulder

/**
 * Representation of a winding map for a face (or an edge as a delta)
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import { alpenglow } from '../alpenglow.js';
import type { RenderPath } from '../render-program/RenderPath.js';

export class WindingMap {
  public constructor( public readonly map: Map<RenderPath, number> = new Map() ) {}

  public getWindingNumber( renderPath: RenderPath ): number {
    return this.map.get( renderPath ) || 0;
  }

  public addWindingNumber( renderPath: RenderPath, amount: number ): void {
    const current = this.getWindingNumber( renderPath );
    this.map.set( renderPath, current + amount );
  }

  public addWindingMap( windingMap: WindingMap ): void {
    for ( const [ renderPath, winding ] of windingMap.map ) {
      this.addWindingNumber( renderPath, winding );
    }
  }

  public equals( windingMap: WindingMap ): boolean {
    if ( this.map.size !== windingMap.map.size ) {
      return false;
    }
    for ( const [ renderPath, winding ] of this.map ) {
      if ( winding !== windingMap.getWindingNumber( renderPath ) ) {
        return false;
      }
    }
    return true;
  }
}

alpenglow.register( 'WindingMap', WindingMap );