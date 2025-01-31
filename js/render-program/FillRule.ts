// Copyright 2023-2025, University of Colorado Boulder

/**
 * Fill rules, for determining how to fill a path (given the winding number of a face)
 *
 * Nonzero
 * The path will be filled when it's winding number does not equal zero. In general this fill rule is
 * the default for PhET Scenery Stack rendering. For more info see: https://en.wikipedia.org/wiki/Nonzero-rule
 *
 * Even-odd
 * The path will be filled when the winding number is odd. For more
 * info see: https://en.wikipedia.org/wiki/Even%E2%80%93odd_rule
 *
 * Positive / Negative
 * These fill rules are used for 3D rendering. Only paths that have counter-clockwise orientations
 * will be filled in the positive fill rule (facing the camera). Paths with clockwise orientations will be filled in
 * the negative fill rule (away from the camera).
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

export type FillRule = 'nonzero' | 'evenodd' | 'positive' | 'negative';

export const isWindingIncluded = ( windingNumber: number, fillRule: FillRule ): boolean => {
  switch( fillRule ) {
    case 'nonzero':
      return windingNumber !== 0;
    case 'evenodd':
      return windingNumber % 2 !== 0;
    case 'positive':
      return windingNumber > 0;
    case 'negative':
      return windingNumber < 0;
    default:
      throw new Error( 'unknown fill rule' );
  }
};