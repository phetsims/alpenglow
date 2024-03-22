// Copyright 2023, University of Colorado Boulder

/**
 * General purpose line-clipping algorithms
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */
import Vector2 from '../../../dot/js/Vector2.js';
import { alpenglow } from '../imports.js';

export default class LineClipping {
  /**
   * From "Another Simple but Faster Method for 2D Line Clipping" (2019)
   * by Dimitrios Matthes and Vasileios Drakopoulos
   *
   * This will:
   * - mutate the given points, so that they are clipped to the given axis-aligned bounding box, and
   * - return whether the line segment intersects the bounds
   */
  public static matthesDrakopoulosClip(
    p0: Vector2, p1: Vector2,
    minX: number, minY: number, maxX: number, maxY: number
  ): boolean {
    const x0 = p0.x;
    const y0 = p0.y;
    const x1 = p1.x;
    const y1 = p1.y;

    if (
      !( x0 < minX && x1 < minX ) &&
      !( x0 > maxX && x1 > maxX ) &&
      !( y0 < minY && y1 < minY ) &&
      !( y0 > maxY && y1 > maxY )
    ) {
      // TODO: consider NOT computing these if we don't need them? We probably won't use both?
      const ma = ( y1 - y0 ) / ( x1 - x0 );
      const mb = ( x1 - x0 ) / ( y1 - y0 );

      // TODO: on GPU, consider if we should extract out partial subexpressions below

      // Unrolled (duplicated essentially)
      if ( p0.x < minX ) {
        p0.x = minX;
        p0.y = ma * ( minX - x0 ) + y0;
      }
      else if ( p0.x > maxX ) {
        p0.x = maxX;
        p0.y = ma * ( maxX - x0 ) + y0;
      }
      if ( p0.y < minY ) {
        p0.y = minY;
        p0.x = mb * ( minY - y0 ) + x0;
      }
      else if ( p0.y > maxY ) {
        p0.y = maxY;
        p0.x = mb * ( maxY - y0 ) + x0;
      }

      // Second unrolled form
      if ( p1.x < minX ) {
        p1.x = minX;
        p1.y = ma * ( minX - x0 ) + y0;
      }
      else if ( p1.x > maxX ) {
        p1.x = maxX;
        p1.y = ma * ( maxX - x0 ) + y0;
      }
      if ( p1.y < minY ) {
        p1.y = minY;
        p1.x = mb * ( minY - y0 ) + x0;
      }
      else if ( p1.y > maxY ) {
        p1.y = maxY;
        p1.x = mb * ( maxY - y0 ) + x0;
      }

      if ( !( p0.x < minX && p1.x < minX ) && !( p0.x > maxX && p1.x > maxX ) ) {
        return true;
      }
    }

    return false;
  }
}

alpenglow.register( 'LineClipping', LineClipping );