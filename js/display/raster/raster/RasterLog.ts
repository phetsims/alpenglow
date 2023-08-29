// Copyright 2023, University of Colorado Boulder

/**
 * Allows logging of data from the rasterization process, for display or debugging purposes
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { IntegerEdge, RationalBoundary, RationalFace, RationalHalfEdge, RenderableFace, scenery } from '../../../imports.js';
import Vector2 from '../../../../../dot/js/Vector2.js';
import Matrix3 from '../../../../../dot/js/Matrix3.js';
import Bounds2 from '../../../../../dot/js/Bounds2.js';

export default class RasterLog {
  public scale: number | null = null;
  public translation: Vector2 | null = null;
  public toIntegerMatrix: Matrix3 | null = null;
  public fromIntegerMatrix: Matrix3 | null = null;
  public integerEdges: IntegerEdge[] | null = null;
  public filteredRationalHalfEdges: RationalHalfEdge[] | null = null;
  public refilteredRationalHalfEdges: RationalHalfEdge[] | null = null;
  public innerBoundaries: RationalBoundary[] | null = null;
  public outerBoundaries: RationalBoundary[] | null = null;
  public faces: RationalFace[] | null = null;
  public unboundedFace: RationalFace | null = null;
  public renderedFaces: RationalFace[] | null = null;
  public initialRenderableFaces: RenderableFace[] | null = null;
  public renderableFaces: RenderableFace[] | null = null;
  public partialAreas: Bounds2[] = [];
  public fullAreas: Bounds2[] = [];
}

scenery.register( 'RasterLog', RasterLog );