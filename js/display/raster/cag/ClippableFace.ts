// Copyright 2023, University of Colorado Boulder

/**
 * An interface for clippable/subdivide-able faces, with defined bounds and area.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import Bounds2 from '../../../../../dot/js/Bounds2.js';
import Range from '../../../../../dot/js/Range.js';
import Vector2 from '../../../../../dot/js/Vector2.js';
import Matrix3 from '../../../../../dot/js/Matrix3.js';

type ClippableFace = {
  getBounds(): Bounds2;
  getDotRange( normal: Vector2 ): Range;
  getDistanceRange( point: Vector2 ): Range;
  getArea(): number;
  getCentroid( area: number ): Vector2;
  getTransformed( transform: Matrix3 ): ClippableFace;
  getClipped( bounds: Bounds2 ): ClippableFace;
  getBinaryXClip( x: number, fakeCornerY: number ): { minFace: ClippableFace; maxFace: ClippableFace };
  getBinaryYClip( y: number, fakeCornerX: number ): { minFace: ClippableFace; maxFace: ClippableFace };
  getBinaryLineClip( normal: Vector2, value: number, fakeCornerPerpendicular: number ): { minFace: ClippableFace; maxFace: ClippableFace };
  getStripeLineClip( normal: Vector2, values: number[], fakeCornerPerpendicular: number ): ClippableFace[];
  getBinaryCircularClip( center: Vector2, radius: number, maxAngleSplit: number ): { insideFace: ClippableFace; outsideFace: ClippableFace };
};

export default ClippableFace;
