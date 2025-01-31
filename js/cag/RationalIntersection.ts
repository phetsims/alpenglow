// Copyright 2023-2025, University of Colorado Boulder

/**
 * Represents a point of an intersection (with rational t and point) along a segment.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow } from '../alpenglow.js';
import type { BigRational } from './BigRational.js';
import type { BigRationalVector2 } from './BigRationalVector2.js';

export class RationalIntersection {
  public constructor( public readonly t: BigRational, public readonly point: BigRationalVector2 ) {}
}

alpenglow.register( 'RationalIntersection', RationalIntersection );