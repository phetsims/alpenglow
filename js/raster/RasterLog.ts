// Copyright 2023-2025, University of Colorado Boulder

/**
 * Allows logging of data from the rasterization process, for display or debugging purposes
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import Bounds2 from '../../../dot/js/Bounds2.js';
import Matrix3 from '../../../dot/js/Matrix3.js';
import Vector2 from '../../../dot/js/Vector2.js';
import { alpenglow } from '../alpenglow.js';
import type { RenderableFace } from './RenderableFace.js';
import type { IntegerEdge } from '../cag/IntegerEdge.js';
import type { RationalHalfEdge } from '../cag/RationalHalfEdge.js';
import type { RationalBoundary } from '../cag/RationalBoundary.js';
import type { RationalFace } from '../cag/RationalFace.js';

export class RasterLog {
  public scale: number | null = null;
  public partialAreas: Bounds2[] = [];
  public fullAreas: Bounds2[] = [];
  public tileLogs: RasterTileLog[] = [];
  public renderableFaces: RenderableFace[] | null = null;
}

export class RasterTileLog {
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

  // How many integer intersections were detected
  public integerIntersectionCount = 0;

  // How many times we ran the integer intersection computation
  public integerIntersectionComputationCount = 0;

  // How many times we inspected bounds between two edges (or groups), to see if we should try intersecting them
  public integerIntersectionOverlapCheckCount = 0;


}

alpenglow.register( 'RasterLog', RasterLog );