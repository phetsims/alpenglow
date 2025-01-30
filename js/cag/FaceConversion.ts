// Copyright 2023-2024, University of Colorado Boulder

/**
 * Multiple methods of conversion from RationalFaces to RenderableFaces.
 *
 * They mostly differ on whether they combine faces with equivalent RenderPrograms, WHICH cases they do so, and
 * whether they output polygonal or unsorted-edge formats (PolygonalFace/EdgedFace).
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import Bounds2 from '../../../dot/js/Bounds2.js';
import Matrix3 from '../../../dot/js/Matrix3.js';
import { RationalFace } from './RationalFace.js';
import { RenderProgram } from '../render-program/RenderProgram.js';
import { ClippableFace, ClippableFaceAccumulator } from './ClippableFace.js';
import { RenderableFace } from '../raster/RenderableFace.js';
import { alpenglow } from '../alpenglow.js';

class AccumulatingFace {
  public faces = new Set<RationalFace>();
  public facesToProcess: RationalFace[] = [];
  public renderProgram: RenderProgram | null = null;
  public bounds: Bounds2 = Bounds2.NOTHING.copy();
  public clippableFace: ClippableFace | null = null;
}

export class FaceConversion {
  public static toSimpleRenderableFaces(
    faces: RationalFace[],
    fromIntegerMatrix: Matrix3,
    accumulator: ClippableFaceAccumulator
  ): RenderableFace[] {
    const renderableFaces: RenderableFace[] = [];

    for ( let i = 0; i < faces.length; i++ ) {
      const face = faces[ i ];

      face.toAccumulator( accumulator, fromIntegerMatrix );

      const clippableFace = accumulator.finalizeFace();

      if ( clippableFace ) {
        renderableFaces.push( new RenderableFace(
          clippableFace,
          face.renderProgram!,
          // TODO: HEY HEY why are we double transforming the points? Just get the bounds... from the clippable face?
          // TODO: Or... get the bounds during the accumulation process?
          face.getBounds( fromIntegerMatrix )
        ) );
      }
    }

    return renderableFaces;
  }

  public static toFullyCombinedRenderableFaces(
    faces: RationalFace[],
    fromIntegerMatrix: Matrix3,
    accumulator: ClippableFaceAccumulator
  ): RenderableFace[] {

    const faceEquivalenceClasses: Set<RationalFace>[] = [];

    for ( let i = 0; i < faces.length; i++ ) {
      const face = faces[ i ];
      let found = false;

      for ( let j = 0; j < faceEquivalenceClasses.length; j++ ) {
        const faceEquivalenceClass = faceEquivalenceClasses[ j ];
        const representative: RationalFace = faceEquivalenceClass.values().next().value!;
        if ( face.renderProgram!.equals( representative.renderProgram! ) ) {
          faceEquivalenceClass.add( face );
          found = true;
          break;
        }
      }

      if ( !found ) {
        const newSet = new Set<RationalFace>();
        newSet.add( face );
        faceEquivalenceClasses.push( newSet );
      }
    }

    const renderableFaces: RenderableFace[] = [];
    for ( let i = 0; i < faceEquivalenceClasses.length; i++ ) {
      const faces = faceEquivalenceClasses[ i ];

      let renderProgram: RenderProgram | null = null;
      const bounds = Bounds2.NOTHING.copy();

      for ( const face of faces ) {
        renderProgram = face.renderProgram!;

        // TODO: don't double transform the points, just get the bounds from the clippable face
        bounds.includeBounds( face.getBounds( fromIntegerMatrix ) );
        face.toAccumulator( accumulator, fromIntegerMatrix );
      }

      const clippedFace = accumulator.finalizeFace();

      if ( clippedFace ) {
        renderableFaces.push( new RenderableFace( clippedFace, renderProgram!, bounds ) );
      }
    }

    return renderableFaces;
  }

  // Will combine faces that have equivalent RenderPrograms IFF they border each other (leaving separate programs with
  // equivalent RenderPrograms separate if they don't border). It will also remove edges that border between faces
  // that we combine (thus switching to EdgedFaces with unsorted edges).
  public static toSimplifyingCombinedRenderableFaces(
    faces: RationalFace[],
    fromIntegerMatrix: Matrix3,
    accumulator: ClippableFaceAccumulator
  ): RenderableFace[] {

    const accumulatedFaces: AccumulatingFace[] = [];

    // TODO: see if we need micro-optimizations here
    faces.forEach( face => {
      if ( accumulatedFaces.every( accumulatedFace => !accumulatedFace.faces.has( face ) ) ) {
        const newAccumulatedFace = new AccumulatingFace();
        newAccumulatedFace.faces.add( face );
        newAccumulatedFace.facesToProcess.push( face );
        newAccumulatedFace.renderProgram = face.renderProgram!;
        newAccumulatedFace.bounds.includeBounds( face.getBounds( fromIntegerMatrix ) );

        const incompatibleFaces = new Set<RationalFace>();

        // NOTE: side effects!
        const isFaceCompatible = ( face: RationalFace ): boolean => {
          if ( incompatibleFaces.has( face ) ) {
            return false;
          }
          if ( newAccumulatedFace.faces.has( face ) ) {
            return true;
          }

          // Not in either place, we need to test
          if ( face.renderProgram && newAccumulatedFace.renderProgram!.equals( face.renderProgram ) ) {
            newAccumulatedFace.faces.add( face );
            newAccumulatedFace.facesToProcess.push( face );
            newAccumulatedFace.bounds.includeBounds( face.getBounds( fromIntegerMatrix ) );
            return true;
          }
          else {
            incompatibleFaces.add( face );
            return false;
          }
        };

        accumulatedFaces.push( newAccumulatedFace );

        while ( newAccumulatedFace.facesToProcess.length ) {
          const faceToProcess = newAccumulatedFace.facesToProcess.pop()!;

          for ( const boundary of [
            faceToProcess.boundary,
            ...faceToProcess.holes
          ] ) {
            for ( const edge of boundary.edges ) {
              if ( !isFaceCompatible( edge.reversed.face! ) ) {
                const startPoint = fromIntegerMatrix.timesVector2( edge.p0float );
                const endPoint = fromIntegerMatrix.timesVector2( edge.p1float );
                accumulator.addEdge( startPoint.x, startPoint.y, endPoint.x, endPoint.y, startPoint, endPoint );
              }
            }
          }
        }

        newAccumulatedFace.clippableFace = accumulator.finalizeFace();
      }
    } );

    return accumulatedFaces.filter( accumulatedFace => !!accumulatedFace.clippableFace ).map( accumulatedFace => {
      assert && assert( accumulatedFace.clippableFace );

      return new RenderableFace(
        accumulatedFace.clippableFace!,
        accumulatedFace.renderProgram!,
        accumulatedFace.bounds
      );
    } );
  }

  /**
   * Combines faces that have equivalent RenderPrograms IFF they border each other (leaving separate programs with
   * equivalent RenderPrograms separate if they don't border). It will also remove edges that border between faces
   * that we combine, and will connect edges to keep things polygonal!
   */
  public static toTracedRenderableFaces(
    faces: RationalFace[],
    fromIntegerMatrix: Matrix3,
    accumulator: ClippableFaceAccumulator
  ): RenderableFace[] {

    return RationalFace.traceCombineFaces(
      faces,
      fromIntegerMatrix,
      ( face: RationalFace ): RenderProgram => face.renderProgram!,
      ( face: ClippableFace, renderProgram: RenderProgram, bounds: Bounds2 ) => new RenderableFace( face, renderProgram, bounds ),
      ( programA: RenderProgram, programB: RenderProgram | null ) => {
        return !!programB && programA.equals( programB );
      },
      accumulator
    );
  }
}

alpenglow.register( 'FaceConversion', FaceConversion );