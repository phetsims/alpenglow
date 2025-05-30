// Copyright 2023-2025, University of Colorado Boulder

/**
 * Represents a RenderProgram on a planar (3d) surface.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import Matrix3 from '../../../dot/js/Matrix3.js';
import Plane3 from '../../../dot/js/Plane3.js';
import Range from '../../../dot/js/Range.js';
import Vector2 from '../../../dot/js/Vector2.js';
import Vector3 from '../../../dot/js/Vector3.js';
import { alpenglow } from '../alpenglow.js';
import type { ClippableFace } from '../cag/ClippableFace.js';
import { EdgedFace } from '../cag/ClippableFace.js';
import type { RenderProgram } from './RenderProgram.js';

// TODO: better name
export class RenderPlanar {

  public readonly plane: Plane3;

  public constructor(
    public readonly program: RenderProgram,
    public readonly pointA: Vector3,
    public readonly pointB: Vector3,
    public readonly pointC: Vector3
  ) {
    this.plane = Plane3.fromTriangle( pointA, pointB, pointC )!;
    assert && assert( this.plane );

    assert && assert( this.plane.normal.z !== 0,
      'If the normal is perpendicular to the Z axis, it will not define a valid depth for any point' );
  }

  public getDepth( x: number, y: number ): number {
    // find z such that (p.x, p.y, z) . normal = distance
    // p.x * normal.x + p.y * normal.y + z * normal.z = distance
    // z = (distance - p.x * normal.x - p.y * normal.y) / normal.z
    return ( this.plane.distance - x * this.plane.normal.x - y * this.plane.normal.y ) / this.plane.normal.z;
  }

  /**
   * Returns the range of potential depth values included in the face.
   */
  public getDepthRange( face: ClippableFace ): Range {
    const normal2 = Vector2.from( this.plane.normal );

    // If our normal x,y is zero, then we are parallel to the z axis, and we can't get a depth range
    if ( normal2.magnitude < 1e-10 ) {
      const depth = this.getDepth( 0, 0 );
      return new Range( depth, depth );
    }

    // Our normal will point along the gradient for depth. We'll be able to probe the depth values at both extremes
    normal2.normalize();
    const dotRange = face.getDotRange( normal2 );

    const minPoint = normal2.timesScalar( dotRange.min );
    const maxPoint = normal2.timesScalar( dotRange.max );

    // NOTE: These are depths AT each range of points, need to find out which is larger and which is smaller
    const minDepth = this.getDepth( minPoint.x, minPoint.y );
    const maxDepth = this.getDepth( maxPoint.x, maxPoint.y );

    return new Range( Math.min( minDepth, maxDepth ), Math.max( minDepth, maxDepth ) );
  }

  public getDepthSplit( planar: RenderPlanar, face: ClippableFace ): { ourFaceFront: ClippableFace | null; otherFaceFront: ClippableFace | null } {
    const intersectionRay = this.plane.getIntersection( planar.plane );

    if ( intersectionRay ) {
      const position = Vector2.from( intersectionRay.position ); // strip z
      const direction = Vector2.from( intersectionRay.direction ).normalized(); // strip z
      const normal = direction.perpendicular;
      const value = position.dot( normal );
      const fakeCornerPerpendicular = face instanceof EdgedFace ? face.getBounds().center.dot( direction ) : 0; // TODO: how to best handle this?

      // TODO: we COULD check to see if our line actually goes through the bounding box of the face. If not, we can just
      // TODO: determine which side of the line we're on, and skip the clip!
      // TODO: ON THE OTHER HAND this is somewhat equivalent to the depth-range filtering we should be doing, so perhaps
      // TODO: do that instead and keep this simple
      const { minFace, maxFace } = face.getBinaryLineClip( normal, value, fakeCornerPerpendicular );

      const somePointInMin = normal.timesScalar( value - 5 );
      // const somePointInMin = minFace.getCentroid( minFace.getArea() );
      const areWeMinFront = this.getDepth( somePointInMin.x, somePointInMin.y ) < planar.getDepth( somePointInMin.x, somePointInMin.y );

      const ourFaceFront = areWeMinFront ? minFace : maxFace;
      const otherFaceFront = areWeMinFront ? maxFace : minFace;

      // TODO: Our centroid code is slightly inaccurate here, due to numerical precision issues
      // if ( assertSlow ) {
      //   if ( ourFaceFront.getArea() > 1e-8 ) {
      //     const centroid = ourFaceFront.getCentroid( ourFaceFront.getArea() );
      //     assertSlow( this.getDepth( centroid.x, centroid.y ) <= planar.getDepth( centroid.x, centroid.y ) + 0.0001 );
      //   }
      //   if ( otherFaceFront.getArea() > 1e-8 ) {
      //     const centroid = otherFaceFront.getCentroid( otherFaceFront.getArea() );
      //     assertSlow( this.getDepth( centroid.x, centroid.y ) >= planar.getDepth( centroid.x, centroid.y ) - 0.0001 );
      //   }
      // }

      return {
        ourFaceFront: ourFaceFront,
        otherFaceFront: otherFaceFront
      };
    }
    else {
      // They are parallel (or the same plane)

      if ( this.getDepth( 0, 0 ) < planar.getDepth( 0, 0 ) ) {
        return { ourFaceFront: face, otherFaceFront: null };
      }
      else {
        return { ourFaceFront: null, otherFaceFront: face };
      }
    }
  }

  public transformed( transform: Matrix3 ): RenderPlanar {

    const pA = transform.timesVector2( new Vector2( this.pointA.x, this.pointA.y ) );
    const pB = transform.timesVector2( new Vector2( this.pointB.x, this.pointB.y ) );
    const pC = transform.timesVector2( new Vector2( this.pointC.x, this.pointC.y ) );

    return new RenderPlanar(
      this.program.transformed( transform ),
      new Vector3( pA.x, pA.y, this.pointA.z ),
      new Vector3( pB.x, pB.y, this.pointB.z ),
      new Vector3( pC.x, pC.y, this.pointC.z )
    );
  }

  public withProgram( program: RenderProgram ): RenderPlanar {
    if ( program === this.program ) {
      return this;
    }

    return new RenderPlanar( program, this.pointA, this.pointB, this.pointC );
  }
}

alpenglow.register( 'RenderPlanar', RenderPlanar );