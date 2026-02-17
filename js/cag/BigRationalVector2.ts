// Copyright 2023-2025, University of Colorado Boulder

/**
 * Like Vector2, but with BigRationals
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import { alpenglow } from '../alpenglow.js';
import type { BigRational } from './BigRational.js';

export class BigRationalVector2 {
  public constructor( public x: BigRational, public y: BigRational ) {}

  public equals( vector: BigRationalVector2 ): boolean {
    return this.x.equals( vector.x ) && this.y.equals( vector.y );
  }

  public toString(): string {
    return `(${this.x}, ${this.y})`;
  }

  // TODO
}

alpenglow.register( 'BigRationalVector2', BigRationalVector2 );