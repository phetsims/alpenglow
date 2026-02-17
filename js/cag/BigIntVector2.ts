// Copyright 2023-2025, University of Colorado Boulder

/**
 * Like Vector2, but with BigInts
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import { alpenglow } from '../alpenglow.js';

export class BigIntVector2 {
  public constructor( public x: bigint, public y: bigint ) {}

  public equals( vector: BigIntVector2 ): boolean {
    return this.x === vector.x && this.y === vector.y;
  }

  public toString(): string {
    return `(${this.x}, ${this.y})`;
  }

  // TODO
}

alpenglow.register( 'BigIntVector2', BigIntVector2 );