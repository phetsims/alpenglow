// Copyright 2023-2024, University of Colorado Boulder

/**
 * Like Vector2, but with BigInts
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow } from '../imports.js';

export default class BigIntVector2 {
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