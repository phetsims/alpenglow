// Copyright 2023-2025, University of Colorado Boulder

/**
 * Allows computing boolean operations on polygons (e.g. union, intersection, difference/complement)
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import Bounds2 from '../../../dot/js/Bounds2.js';
import Matrix3 from '../../../dot/js/Matrix3.js';
import Vector2 from '../../../dot/js/Vector2.js';
import { alpenglow } from '../alpenglow.js';
import { PolygonalFace } from './ClippableFace.js';
import { RationalFace } from './RationalFace.js';
import { RationalHalfEdge } from './RationalHalfEdge.js';
import { LineSplitter } from './LineSplitter.js';
import { HilbertMapping } from './HilbertMapping.js';
import { IntegerEdge } from './IntegerEdge.js';
import { LineIntersector } from './LineIntersector.js';
import type { RenderPath } from '../render-program/RenderPath.js';
import type { RationalBoundary } from './RationalBoundary.js';
import type { RasterTileLog } from '../raster/RasterLog.js';

const defaultLineIntersector = LineIntersector.edgeIntersectionArrayBoundsTree;

export class PolygonalBoolean {

  public static union( ...paths: RenderPath[] ): Vector2[][] {
    return PolygonalBoolean.cag(
      paths,
      face => face.getIncludedRenderPaths().size > 0,
      ( face, faceData, bounds ) => faceData ? face.polygons : [],
      ( faceData1, faceData2 ) => faceData1 === faceData2,
      null
    ).flat();
  }

  public static intersection( ...paths: RenderPath[] ): Vector2[][] {
    return PolygonalBoolean.cag(
      paths,
      face => face.getIncludedRenderPaths().size === paths.length,
      ( face, faceData, bounds ) => faceData ? face.polygons : [],
      ( faceData1, faceData2 ) => faceData1 === faceData2,
      null
    ).flat();
  }

  public static difference( pathA: RenderPath, pathB: RenderPath ): Vector2[][] {
    return PolygonalBoolean.cag(
      [ pathA, pathB ],
      face => {
        const set = face.getIncludedRenderPaths();
        return set.has( pathA ) && !set.has( pathB );
      },
      ( face, faceData, bounds ) => faceData ? face.polygons : [],
      ( faceData1, faceData2 ) => faceData1 === faceData2,
      null
    ).flat();
  }

  public static getOverlaps( pathA: RenderPath, pathB: RenderPath ): { intersection: Vector2[][]; aOnly: Vector2[][]; bOnly: Vector2[][] } {
    const taggedPolygonsList = PolygonalBoolean.cag(
      [ pathA, pathB ],
      ( face: RationalFace ): 'intersection' | 'aOnly' | 'bOnly' | null => {
        const set = face.getIncludedRenderPaths();

        if ( set.has( pathA ) && set.has( pathB ) ) {
          return 'intersection';
        }
        else if ( set.has( pathA ) ) {
          return 'aOnly';
        }
        else if ( set.has( pathB ) ) {
          return 'bOnly';
        }
        else {
          return null;
        }
      },
      ( face, faceData, bounds ) => ( { tag: faceData, polygons: face.polygons } ),
      ( faceData1, faceData2 ) => faceData1 === faceData2,
      null
    );

    const result: { intersection: Vector2[][]; aOnly: Vector2[][]; bOnly: Vector2[][] } = {
      intersection: [],
      aOnly: [],
      bOnly: []
    };

    taggedPolygonsList.forEach( taggedPolygon => {
      if ( taggedPolygon.tag !== null ) {
        result[ taggedPolygon.tag ].push( ...taggedPolygon.polygons );
      }
    } );

    return result;
  }

  // TODO: ideally handle the fully collinear simplification?

  public static cag<FaceData, OutputFace>(
    paths: RenderPath[],
    getFaceData: ( face: RationalFace ) => FaceData,
    createOutputFace: ( face: PolygonalFace, faceData: FaceData, bounds: Bounds2 ) => OutputFace,
    // null is for the unbounded face
    isFaceDataCompatible: ( faceData1: FaceData, faceData2: FaceData | null ) => boolean,
    log: RasterTileLog | null
  ): OutputFace[] {

    const bounds = Bounds2.NOTHING.copy();
    for ( let i = 0; i < paths.length; i++ ) {
      bounds.includeBounds( paths[ i ].getBounds() );
    }

    // Keep us at 20 bits of precision (after rounding)
    const scale = Math.pow( 2, 20 - Math.ceil( Math.log2( Math.max( bounds.width, bounds.height ) ) ) );

    const translation = new Vector2(
      -0.5 * scale * ( bounds.minX + bounds.maxX ),
      -0.5 * scale * ( bounds.minY + bounds.maxY )
    );

    const toIntegerMatrix = Matrix3.affine( scale, 0, translation.x, 0, scale, translation.y );
    const fromIntegerMatrix = toIntegerMatrix.inverted();

    // Verify our math! Make sure we will be perfectly centered in our integer grid!
    assert && assert( Math.abs( ( scale * bounds.minX + translation.x ) + ( scale * bounds.maxX + translation.x ) ) < 1e-7 );
    assert && assert( Math.abs( ( scale * bounds.minY + translation.y ) + ( scale * bounds.maxY + translation.y ) ) < 1e-7 );

    const integerEdges = IntegerEdge.scaleToIntegerEdges( paths, toIntegerMatrix );

    HilbertMapping.sortCenterMinMax( integerEdges, 1 / ( scale * Math.max( bounds.width, bounds.height ) ) );

    // TODO: optional hilbert space-fill sort here?

    defaultLineIntersector( integerEdges, log );

    const rationalHalfEdges = LineSplitter.splitIntegerEdges( integerEdges );

    rationalHalfEdges.sort( ( a, b ) => a.compare( b ) );

    let filteredRationalHalfEdges = RationalHalfEdge.filterAndConnectHalfEdges( rationalHalfEdges );

    const innerBoundaries: RationalBoundary[] = [];
    const outerBoundaries: RationalBoundary[] = [];
    const faces: RationalFace[] = [];
    filteredRationalHalfEdges = RationalFace.traceBoundaries( filteredRationalHalfEdges, innerBoundaries, outerBoundaries, faces );

    const exteriorBoundaries = RationalFace.computeFaceHolesWithOrderedWindingNumbers(
      outerBoundaries,
      faces
    );

    // For ease of use, an unbounded face (it is essentially fake)
    const unboundedFace = RationalFace.createUnboundedFace( ...exteriorBoundaries );

    RationalFace.computeWindingMaps( filteredRationalHalfEdges, unboundedFace );

    return RationalFace.traceCombineFaces(
      faces,
      fromIntegerMatrix,
      getFaceData,
      createOutputFace,
      isFaceDataCompatible,
      PolygonalFace.getScratchAccumulator()
    );
  }
}

alpenglow.register( 'PolygonalBoolean', PolygonalBoolean );