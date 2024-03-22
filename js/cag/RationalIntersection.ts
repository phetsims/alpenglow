// Copyright 2023, University of Colorado Boulder

/**
 * Represents a point of an intersection (with rational t and point) along a segment.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BigRational, BigRationalVector2 } from '../imports.js';

export default class RationalIntersection {
  public constructor( public readonly t: BigRational, public readonly point: BigRationalVector2 ) {}
}

alpenglow.register( 'RationalIntersection', RationalIntersection );