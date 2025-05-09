// Copyright 2023-2025, University of Colorado Boulder

/**
 * Test rasterization
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import Bounds2 from '../../../dot/js/Bounds2.js';
import Matrix3 from '../../../dot/js/Matrix3.js';
import { clamp } from '../../../dot/js/util/clamp.js';
import Vector2 from '../../../dot/js/Vector2.js';
import Vector4 from '../../../dot/js/Vector4.js';
import { optionize3 } from '../../../phet-core/js/optionize.js';
import { alpenglow } from '../alpenglow.js';
import { getPolygonFilterGridBounds, getPolygonFilterGridOffset, getPolygonFilterWidth, PolygonFilterType } from '../render-program/PolygonFilterType.js';
import { RasterLog, RasterTileLog } from './RasterLog.js';
import { RenderEvaluationContext } from '../render-program/RenderEvaluationContext.js';
import type { ClippableFace, ClippableFaceAccumulator } from '../cag/ClippableFace.js';
import { EdgedFace, EdgedFaceAccumulator } from '../cag/ClippableFace.js';
import { PolygonalFace, PolygonalFaceAccumulator } from '../cag/ClippableFace.js';
import type { OutputRaster } from './OutputRaster.js';
import type { RenderEvaluator, RenderProgram } from '../render-program/RenderProgram.js';
import { RenderProgramNeeds } from '../render-program/RenderProgramNeeds.js';
import { RationalFace } from '../cag/RationalFace.js';
import { RenderPathReplacer } from '../render-program/RenderPathReplacer.js';
import { PolygonMitchellNetravali } from './PolygonMitchellNetravali.js';
import { RenderableFace } from './RenderableFace.js';
import { RenderExecutor } from '../render-program/RenderExecutor.js';
import { EdgedClippedFace } from '../cag/ClippableFace.js';
import { RenderPath } from '../render-program/RenderPath.js';
import { BoundedSubpath } from '../cag/BoundedSubpath.js';
import { IntegerEdge } from '../cag/IntegerEdge.js';
import { HilbertMapping } from '../cag/HilbertMapping.js';
import { LineIntersector } from '../cag/LineIntersector.js';
import { LineSplitter } from '../cag/LineSplitter.js';
import { RationalHalfEdge } from '../cag/RationalHalfEdge.js';
import { RationalBoundary } from '../cag/RationalBoundary.js';
import { FaceConversion } from '../cag/FaceConversion.js';
import { RenderColor } from '../render-program/RenderColor.js';
import { RenderPathBoolean } from '../render-program/RenderPathBoolean.js';

type RenderExecutionMethod = 'evaluation' | 'instructions';

export type RasterizationOptions = {
  // We'll write our results into the output raster at this x,y offset. NOTE: This is not needed when tiling, if we are
  // rendering a region that goes from x:(100,200), by default we will output into the raster at x:(100,200). This
  // should be used if we want to e.g. render a region that goes from x:(100,200) into the raster at x:(0,100).
  outputRasterOffset?: Vector2;

  // Tiling is splitting our processing into (tileSize x tileSize) chunks BEFORE sending our processing to the CAG.
  // Each tile will get CAG'ed separately, and then we'll combine the results. This is useful for large images, where
  // it can reduce the edge-intersection costs. In addition, it will likely be helpful for parallelization.
  tileSize?: number;

  // TODO: doc
  polygonFiltering?: PolygonFilterType;

  // We'll expand the filter window by this multiplier. If it is not 1, it will potentially drop performance
  // significantly (we won't be able to grid-clip to do it efficiently, and it might cover significantly more area).
  polygonFilterWindowMultiplier?: number;

  // TODO: consistent naming conventions
  edgeIntersectionSortMethod?: 'none' | 'center-size' | 'min-max' | 'min-max-size' | 'center-min-max' | 'random';

  edgeIntersectionMethod?: 'quadratic' | 'boundsTree' | 'arrayBoundsTree';

  renderableFaceType?: 'polygonal' | 'edged' | 'edgedClipped';

  // - 'simple' will simply pass through the edges to the renderable faces
  // - 'fullyCombined' will combine ALL faces with equivalent RenderPrograms into one.
  // - 'simplifyingCombined' will (a) only combine compatible faces if they touch, and (b) will remove edges between
  //    compatible faces.
  // - 'traced' will function similarly to simplifyingCombined, but will trace out the resulting polygonal faces.
  renderableFaceMethod?: 'simple' | 'fullyCombined' | 'simplifyingCombined' | 'traced';

  splitPrograms?: boolean;

  executionMethod?: RenderExecutionMethod;

  log?: RasterLog | null;
};

const DEFAULT_OPTIONS = {
  outputRasterOffset: Vector2.ZERO,
  tileSize: 256,
  polygonFiltering: PolygonFilterType.Box,
  polygonFilterWindowMultiplier: 1,
  edgeIntersectionSortMethod: 'center-min-max',
  edgeIntersectionMethod: 'arrayBoundsTree',
  renderableFaceType: 'polygonal',
  renderableFaceMethod: 'traced',
  splitPrograms: true,
  executionMethod: 'instructions',
  log: null
} as const;

const scratchFullAreaVector = new Vector2( 0, 0 );
const scratchEvaluationOutputVector = new Vector4( 0, 0, 0, 0 );

const scratchEvaluationContext = new RenderEvaluationContext();

const nanVector = new Vector2( NaN, NaN );

const terminalAreas: number[] = [];
const terminalCentroids: Vector2[] = [];
const terminalFinalizeCounters: number[] = [];
let terminalFaceAccumulators: ClippableFaceAccumulator[] = [];

const terminalEdgedFaceAccumulators: EdgedFaceAccumulator[] = [];
const terminalPolygonalFaceAccumulators: PolygonalFaceAccumulator[] = [];

class RasterizationContext {
  public constructor(
    public outputRaster: OutputRaster,
    // EITHER evaluator will be non-null, OR constClientColor/constOutputColor will be non-null
    public evaluate: RenderEvaluator | null,
    public constClientColor: Vector4 | null,
    public constOutputColor: Vector4 | null,
    public outputRasterOffset: Vector2,
    public bounds: Bounds2,
    public polygonFiltering: PolygonFilterType,
    public polygonFilterWindowMultiplier: number,
    public needs: RenderProgramNeeds,
    public log: RasterLog | null
  ) {
    assert && assert( evaluate || ( constClientColor && constOutputColor ) );
  }
}

export class Rasterize {

  private static getRenderProgrammedFaces( renderProgram: RenderProgram, faces: RationalFace[] ): RationalFace[] {
    const renderProgrammedFaces: RationalFace[] = [];

    const replacer = new RenderPathReplacer( renderProgram.simplified() );

    for ( let i = 0; i < faces.length; i++ ) {
      const face = faces[ i ];

      face.renderProgram = replacer.replace( face.getIncludedRenderPaths() );

      if ( assertSlow ) {
        const inclusionSet = face.getIncludedRenderPaths();

        const checkProgram = renderProgram.withPathInclusion( renderPath => inclusionSet.has( renderPath ) ).simplified();

        assertSlow( face.renderProgram.equals( checkProgram ), 'Replacer/simplifier error' );
      }

      // Drop faces that will be fully transparent
      const isFullyTransparent = face.renderProgram instanceof RenderColor && face.renderProgram.color.w <= 1e-8;

      if ( !isFullyTransparent ) {
        renderProgrammedFaces.push( face );
      }
    }

    return renderProgrammedFaces;
  }

  private static addFilterPixel(
    context: RasterizationContext,
    pixelFace: ClippableFace | null,
    area: number,
    x: number,
    y: number,
    color: Vector4
  ): void {

    const polygonFiltering = context.polygonFiltering;
    const bounds = context.bounds;
    const outputRaster = context.outputRaster;
    const outputRasterOffset = context.outputRasterOffset;

    assert && assert( polygonFiltering === PolygonFilterType.Bilinear || polygonFiltering === PolygonFilterType.MitchellNetravali,
      'Only supports these filters currently' );

    const expand = polygonFiltering === PolygonFilterType.MitchellNetravali ? 2 : 1;

    // e.g. x - px is 0,-1 for bilinear, 1,-2 for mitchell-netravali
    // px = x + (0,1) for bilinear, x + (-1,2) for mitchell-netravali

    const subIterMinX = x - expand + 1;
    const subIterMinY = y - expand + 1;
    const subIterMaxX = x + expand + 1;
    const subIterMaxY = y + expand + 1;

    for ( let py = subIterMinY; py < subIterMaxY; py++ ) {

      const pixelY = py - 0.5;
      // TODO: put these in the subIter values above
      if ( pixelY < bounds.minY || pixelY >= bounds.maxY ) {
        continue;
      }

      for ( let px = subIterMinX; px < subIterMaxX; px++ ) {

        const pixelX = px - 0.5;
        if ( pixelX < bounds.minX || pixelX >= bounds.maxX ) {
          continue;
        }

        let contribution;

        // If it has a full pixel of area, we can simplify computation SIGNIFICANTLY
        if ( area > 1 - 1e-8 ) {
          // only bilinear and mitchell-netravali
          contribution = polygonFiltering === PolygonFilterType.MitchellNetravali ? PolygonMitchellNetravali.evaluateFull( px, py, x, y ) : 0.25;
        }
        else {
          assert && assert( pixelFace );

          if ( assertSlow ) {
            const edges = pixelFace!.toEdgedFace().edges;

            assertSlow( edges.every( edge => {
              return edge.startPoint.x >= x && edge.startPoint.x <= x + 1 &&
                     edge.startPoint.y >= y && edge.startPoint.y <= y + 1 &&
                     edge.endPoint.x >= x && edge.endPoint.x <= x + 1 &&
                     edge.endPoint.y >= y && edge.endPoint.y <= y + 1;
            } ) );
          }

          contribution = polygonFiltering === PolygonFilterType.MitchellNetravali ?
                         pixelFace!.getMitchellNetravaliFiltered( px, py, x, y ) :
                         pixelFace!.getBilinearFiltered( px, py, x, y );
        }

        outputRaster.addClientPartialPixel( color.timesScalar( contribution ), pixelX + outputRasterOffset.x, pixelY + outputRasterOffset.y );
      }
    }
  }

  private static addPartialPixel(
    context: RasterizationContext,
    pixelFace: ClippableFace | null,
    area: number,
    centroid: Vector2,
    x: number,
    y: number
  ): void {
    assert && assert( isFinite( area ) );

    const color = scratchEvaluationOutputVector;

    if ( context.constClientColor ) {
      color.set( context.constClientColor );
    }
    else {
      context.evaluate!( scratchEvaluationContext.set(
        pixelFace,
        context.needs.needsArea ? area : NaN,
        centroid,
        x, y, x + 1, y + 1
      ), color );
    }

    if ( context.polygonFiltering === PolygonFilterType.Box ) {
      color.multiplyScalar( area );
      context.outputRaster.addClientPartialPixel( color, x + context.outputRasterOffset.x, y + context.outputRasterOffset.y );
    }
    else {
      assert && assert( pixelFace );

      Rasterize.addFilterPixel(
        context,
        pixelFace, area, x, y, color
      );
    }
  }

  private static addFullArea(
    context: RasterizationContext,
    minX: number,
    minY: number,
    maxX: number,
    maxY: number
  ): void {
    const constClientColor = context.constClientColor;

    if ( constClientColor ) {
      assert && assert( !context.needs.needsArea && !context.needs.needsCentroid );

      if ( context.polygonFiltering === PolygonFilterType.Box ) {
        if ( context.constOutputColor ) {
          context.outputRaster.addOutputFullRegion(
            context.constOutputColor,
            minX + context.outputRasterOffset.x,
            minY + context.outputRasterOffset.y,
            maxX - minX,
            maxY - minY
          );
        }
        else {
          context.outputRaster.addClientFullRegion(
            constClientColor,
            minX + context.outputRasterOffset.x,
            minY + context.outputRasterOffset.y,
            maxX - minX,
            maxY - minY
          );
        }
      }
      else {
        // TODO: ideally we can optimize this if it has a significant number of contained pixels. We only need to
        // "filter" the outside ones (the inside will be a constant color)
        for ( let y = minY; y < maxY; y++ ) {
          for ( let x = minX; x < maxX; x++ ) {
            Rasterize.addFilterPixel( context, null, 1, x, y, constClientColor );
          }
        }
      }
    }
    else {
      const needs = context.needs;
      const polygonFiltering = context.polygonFiltering;
      const outputRaster = context.outputRaster;
      const outputRasterOffset = context.outputRasterOffset;

      const pixelArea = needs.needsArea ? 1 : NaN; // NaNs to hopefully hard-error
      for ( let y = minY; y < maxY; y++ ) {
        for ( let x = minX; x < maxX; x++ ) {
          const color = context.evaluate!( scratchEvaluationContext.set(
            null,
            pixelArea,
            needs.needsCentroid ? scratchFullAreaVector.setXY( x + 0.5, y + 0.5 ) : nanVector,
            x,
            y,
            x + 1,
            y + 1
          ), scratchEvaluationOutputVector );
          if ( polygonFiltering === PolygonFilterType.Box ) {
            outputRaster.addClientFullPixel( color, x + outputRasterOffset.x, y + outputRasterOffset.y );
          }
          else {
            Rasterize.addFilterPixel( context, null, 1, x, y, color );
          }
        }
      }
    }
  }

  private static terminalGridRasterize(
    context: RasterizationContext,
    clippableFace: ClippableFace,
    area: number,
    minX: number,
    minY: number,
    maxX: number,
    maxY: number
  ): void {

    assert && assert( isFinite( minX ) && isFinite( minY ) && isFinite( maxX ) && isFinite( maxY ) );
    assert && assert( minX < maxX && minY < maxY );
    assert && assert( context.polygonFiltering === PolygonFilterType.Box ? Number.isInteger( minX ) : minX - Math.floor( minX ) === 0.5 );
    assert && assert( context.polygonFiltering === PolygonFilterType.Box ? Number.isInteger( minY ) : minY - Math.floor( minY ) === 0.5 );
    assert && assert( context.polygonFiltering === PolygonFilterType.Box ? Number.isInteger( maxX ) : maxX - Math.floor( maxX ) === 0.5 );
    assert && assert( context.polygonFiltering === PolygonFilterType.Box ? Number.isInteger( maxY ) : maxY - Math.floor( maxY ) === 0.5 );

    if ( area < 1e-8 ) {
      return;
    }

    const width = maxX - minX;
    const height = maxY - minY;
    const size = width * height;

    assert && assert( width >= 1 && height >= 1 );
    assert && assert( Number.isInteger( width ) && Number.isInteger( height ) );

    const needsCentroid = context.needs.needsCentroid;
    const needsFace = context.needs.needsFace || context.polygonFiltering !== PolygonFilterType.Box;

    // NOTE NOTE: We just aliased an array to one that has a more specific type (of which they don't overlap)
    // This will work, because if our face is polygonal, it will give us a polygonal accumulator below (and similar
    // for edged).
    const isPolygonal = clippableFace instanceof PolygonalFace;
    terminalFaceAccumulators = isPolygonal ? terminalPolygonalFaceAccumulators : terminalEdgedFaceAccumulators;

    // Reset/initialize the data we'll need
    for ( let i = 0; i < size; i++ ) {
      if ( i < terminalAreas.length ) {
        terminalAreas[ i ] = 0;
      }
      else {
        terminalAreas.push( 0 );
      }

      if ( needsCentroid && i < terminalCentroids.length ) {
        terminalCentroids[ i ].setXY( 0, 0 );
      }
      else {
        terminalCentroids.push( new Vector2( 0, 0 ) );
      }

      if ( needsFace ) {
        if ( i < terminalFinalizeCounters.length ) {
          terminalFinalizeCounters[ i ] = -1;
        }
        else {
          terminalFinalizeCounters.push( -1 );
        }
        if ( i < terminalFaceAccumulators.length ) {
          // If we end up with full/zero area, we won't actually bother finishing up things down below, so we'll want to
          // check this here.
          terminalFaceAccumulators[ i ].reset();
        }
        else {
          // TODO: make sure we get a non-full-collinear polygonal accumulator for fast performance?
          const ix = i % width;
          const iy = Math.floor( i / width );
          const x = minX + ix;
          const y = minY + iy;
          const accumulator = clippableFace.getAccumulator();
          terminalFaceAccumulators.push( accumulator );
          accumulator.setAccumulationBounds( x, y, x + 1, y + 1 );
        }
      }
    }

    let counter = 0;
    let lastFinalizeCounter = 0;

    clippableFace.gridClipIterate(
      minX, minY, maxX, maxY,
      1, 1, width, height,
      (
        cellX: number,
        cellY: number,
        startX: number,
        startY: number,
        endX: number,
        endY: number,
        startPoint: Vector2 | null,
        endPoint: Vector2 | null
      ) => {
        const index = cellY * width + cellX;

        // Shoelace, but we'll handle the division by 2 later
        terminalAreas[ index ] += ( endX + startX ) * ( endY - startY );

        if ( needsCentroid ) {
          const base = ( startX * ( 2 * startY + endY ) + endX * ( startY + 2 * endY ) );
          terminalCentroids[ index ].addXY(
            ( startX - endX ) * base,
            ( endY - startY ) * base
          );
        }

        if ( needsFace ) {
          const faceAccumulator = terminalFaceAccumulators[ index ];

          // If we've run into a completed polygon since we put in our last point, accumulate the result
          if ( terminalFinalizeCounters[ index ] < lastFinalizeCounter ) {
            faceAccumulator.markNewPolygon();
          }

          // Record the point, so we'll wait for the next finalize
          terminalFinalizeCounters[ index ] = counter++;

          // We'll loop around, so we only record the start point for efficiency.
          // The swap between two potential simplifier methods is to potentially avoid GC churn in the future,
          // (we'll want to avoid allocating vectors where possible).
          faceAccumulator.addEdge( startX, startY, endX, endY, startPoint, endPoint );
        }
      },
      () => {
        lastFinalizeCounter = counter++;
      }
    );

    for ( let iy = 0; iy < height; iy++ ) {
      const partialIndex = iy * width;
      const cellMinY = minY + iy;
      const cellMaxY = cellMinY + 1;

      for ( let ix = 0; ix < width; ix++ ) {
        const index = partialIndex + ix;

        const cellMinX = minX + ix;
        const cellMaxX = cellMinX + 1;

        let sanityFace = null;
        if ( assertSlow ) {
          sanityFace = clippableFace.getClipped( cellMinX, cellMinY, cellMaxX, cellMaxY );
        }

        // We saved the division by 2 for here
        const doubleArea = terminalAreas[ index ];
        assertSlow && sanityFace && assertSlow( Math.abs( 0.5 * doubleArea - sanityFace.getArea() ) < 1e-6 );

        if ( doubleArea > 2e-8 ) {
          const area = 0.5 * doubleArea;

          if ( area >= 1 - 1e-8 ) {
            if ( context.log ) { context.log.fullAreas.push( new Bounds2( cellMinX, cellMinY, cellMaxX, cellMaxY ) ); }
            Rasterize.addFullArea(
              context,
              cellMinX, cellMinY, cellMaxX, cellMaxY
            );
          }
          else {
            // We saved the division by 6 for here
            let centroid = nanVector;
            if ( needsCentroid ) {
              centroid = terminalCentroids[ index ].multiplyScalar( 1 / ( 6 * area ) );

              assertSlow && sanityFace && needsCentroid && assertSlow( centroid.distance( sanityFace.getCentroid( sanityFace.getArea() ) ) < 1 );

              // Our centroid computation.... can get inaccuracies from floating-point math. Bleh.
              centroid.x = clamp( centroid.x, cellMinX, cellMaxX );
              centroid.y = clamp( centroid.y, cellMinY, cellMaxY );
            }

            assert && needsCentroid && assert( new Bounds2( cellMinX, cellMinY, cellMaxX, cellMaxY ).containsPoint( centroid ) );

            const face = needsFace ? terminalFaceAccumulators[ index ].finalizeFace() : null;
            assertSlow && sanityFace && needsFace && face && assertSlow( Math.abs( face.getArea() - sanityFace.getArea() ) < 1e-5 );

            if ( context.log ) { context.log.partialAreas.push( new Bounds2( cellMinX, cellMinY, cellMaxX, cellMaxY ) ); }

            // NOTE: NaNs are used to hopefully hard-error if things are used that are listed as not used
            Rasterize.addPartialPixel(
              context,
              face,
              area,
              centroid,
              cellMinX, cellMinY
            );
          }
        }
      }
    }
  }

  private static binaryRasterize(
    context: RasterizationContext,
    clippableFace: ClippableFace,
    area: number,
    minX: number,
    minY: number,
    maxX: number,
    maxY: number
  ): void {

    assert && assert( isFinite( minX ) && isFinite( minY ) && isFinite( maxX ) && isFinite( maxY ) );
    assert && assert( minX < maxX && minY < maxY );
    assert && assert( context.polygonFiltering === PolygonFilterType.Box ? Number.isInteger( minX ) : minX - Math.floor( minX ) === 0.5 );
    assert && assert( context.polygonFiltering === PolygonFilterType.Box ? Number.isInteger( minY ) : minY - Math.floor( minY ) === 0.5 );
    assert && assert( context.polygonFiltering === PolygonFilterType.Box ? Number.isInteger( maxX ) : maxX - Math.floor( maxX ) === 0.5 );
    assert && assert( context.polygonFiltering === PolygonFilterType.Box ? Number.isInteger( maxY ) : maxY - Math.floor( maxY ) === 0.5 );

    // If the area is negligible, skip
    if ( area < 1e-8 ) {
      return;
    }

    const xDiff = maxX - minX;
    const yDiff = maxY - minY;

    assert && assert( xDiff >= 1 && yDiff >= 1 );
    assert && assert( Number.isInteger( xDiff ) && Number.isInteger( yDiff ) );

    if ( area >= ( maxX - minX ) * ( maxY - minY ) - 1e-8 ) {
      if ( context.log ) { context.log.fullAreas.push( new Bounds2( minX, minY, maxX, maxY ) ); }
      Rasterize.addFullArea(
        context,
        minX, minY, maxX, maxY
      );
    }
    else if ( xDiff === 1 && yDiff === 1 ) {
      if ( context.log ) { context.log.partialAreas.push( new Bounds2( minX, minY, maxX, maxY ) ); }

      // NOTE: NaNs are used to hopefully hard-error if things are used that are listed as not used
      Rasterize.addPartialPixel(
        context,
        clippableFace,
        area,
        context.needs.needsCentroid ? clippableFace.getCentroid( area ) : nanVector,
        minX, minY
      );
    }
    // TODO: more experimentation for when to grid clip
    else if ( !context.constClientColor && xDiff <= 8 && yDiff <= 8 ) {
    // else if ( xDiff <= 16 && yDiff <= 16 ) {
      Rasterize.terminalGridRasterize(
        context,
        clippableFace,
        area,
        minX, minY, maxX, maxY
      );
    }
    else {
      const averageX = ( minX + maxX ) / 2;
      const averageY = ( minY + maxY ) / 2;

      if ( xDiff > yDiff ) {
        const xSplit = minX + Math.floor( 0.5 * xDiff );

        assert && assert( xSplit !== minX && xSplit !== maxX );

        // TODO: If this is the LAST level of clipping, can we perhaps skip the actual face output (and only get
        // TODO: area output)?
        const { minFace, maxFace } = clippableFace.getBinaryXClip( xSplit, averageY );

        if ( assertSlow ) {
          const oldMinFace = clippableFace.getClipped( minX, minY, xSplit, maxY );
          const oldMaxFace = clippableFace.getClipped( xSplit, minY, maxX, maxY );

          if ( Math.abs( minFace.getArea() - oldMinFace.getArea() ) > 1e-8 || Math.abs( maxFace.getArea() - oldMaxFace.getArea() ) > 1e-8 ) {
            assertSlow( false, 'binary X clip issue' );
          }
        }

        const minArea = minFace.getArea();
        const maxArea = maxFace.getArea();

        if ( minArea > 1e-8 ) {
          Rasterize.binaryRasterize(
            context,
            minFace, minArea, minX, minY, xSplit, maxY
          );
        }
        if ( maxArea > 1e-8 ) {
          Rasterize.binaryRasterize(
            context,
            maxFace, maxArea, xSplit, minY, maxX, maxY
          );
        }
      }
      else {
        const ySplit = minY + Math.floor( 0.5 * yDiff );

        const { minFace, maxFace } = clippableFace.getBinaryYClip( ySplit, averageX );

        if ( assertSlow ) {
          const oldMinFace = clippableFace.getClipped( minX, minY, maxX, ySplit );
          const oldMaxFace = clippableFace.getClipped( minX, ySplit, maxX, maxY );

          if ( Math.abs( minFace.getArea() - oldMinFace.getArea() ) > 1e-8 || Math.abs( maxFace.getArea() - oldMaxFace.getArea() ) > 1e-8 ) {
            assertSlow( false, 'binary Y clip issue' );
          }
        }

        const minArea = minFace.getArea();
        const maxArea = maxFace.getArea();

        if ( minArea > 1e-8 ) {
          Rasterize.binaryRasterize(
            context,
            minFace, minArea, minX, minY, maxX, ySplit
          );
        }
        if ( maxArea > 1e-8 ) {
          Rasterize.binaryRasterize(
            context,
            maxFace, maxArea, minX, ySplit, maxX, maxY
          );
        }
      }
    }
  }

  /**
   * This exists to handle polygon filtering when the filter multiplier is not 1. This means that our general approach
   * of "split everything into an even grid" might not work, so we'll take a more robust solution.
   *
   * NOTE: Instead of using this, of the filter multiplier is integral, we could probably do other grid clipping
   * magic to avoid this.
   */
  private static windowedFilterRasterize(
    context: RasterizationContext,
    clippableFace: ClippableFace,
    faceBounds: Bounds2
  ): void {
    const outputMinX = context.bounds.minX;
    const outputMaxX = context.bounds.maxX;
    const outputMinY = context.bounds.minY;
    const outputMaxY = context.bounds.maxY;

    const filterWidth = getPolygonFilterWidth( context.polygonFiltering ) * context.polygonFilterWindowMultiplier;
    const filterArea = filterWidth * filterWidth;
    const filterExtension = 0.5 * ( filterWidth - 1 );
    const filterMin = -filterExtension;
    const filterMax = 1 + filterExtension;
    const descaleMatrix = Matrix3.scaling( 1 / context.polygonFilterWindowMultiplier );

    const quadClip = ( face: ClippableFace, x: number, y: number ): {
      minXMinYFace: ClippableFace;
      minXMaxYFace: ClippableFace;
      maxXMinYFace: ClippableFace;
      maxXMaxYFace: ClippableFace;
    } => {
      const xClipped = face.getBinaryXClip( x, y );
      const minXFace = xClipped.minFace;
      const maxXFace = xClipped.maxFace;

      const minXYClipped = minXFace.getBinaryYClip( y, x );
      const maxXYClipped = maxXFace.getBinaryYClip( y, x );
      return {
        minXMinYFace: minXYClipped.minFace,
        minXMaxYFace: minXYClipped.maxFace,
        maxXMinYFace: maxXYClipped.minFace,
        maxXMaxYFace: maxXYClipped.maxFace
      };
    };

    for ( let y = outputMinY; y < outputMaxY; y++ ) {

      const minY = y + filterMin;
      const maxY = y + filterMax;

      // If our filter window is outside of the face bounds, we can skip it entirely
      if ( minY >= faceBounds.maxY || maxY <= faceBounds.minY ) {
        continue;
      }

      for ( let x = outputMinX; x < outputMaxX; x++ ) {

        const minX = x + filterMin;
        const maxX = x + filterMax;

        // If our filter window is outside of the face bounds, we can skip it entirely
        if ( minX >= faceBounds.maxX || maxX <= faceBounds.minX ) {
          continue;
        }

        const clippedFace = clippableFace.getClipped( minX, minY, maxX, maxY );
        const area = clippedFace.getArea();

        if ( area > 1e-8 ) {
          if ( context.constClientColor ) {
            const color = context.constClientColor;

            let contribution = 0;
            if ( context.polygonFiltering === PolygonFilterType.Box ) {
              contribution = area / filterArea;
            }
            else {
              // TODO: we don't have to transform the translation, could handle in the getBilinearFiltered() call etc.
              // get the face with our "pixel" center at the origin, and scaled to the filter window
              const unitFace = clippedFace.getTransformed( descaleMatrix.timesMatrix( Matrix3.translation( -( x + 0.5 ), -( y + 0.5 ) ) ) );

              const quadClipped = quadClip( unitFace, 0, 0 );

              if ( context.polygonFiltering === PolygonFilterType.Bilinear ) {
                contribution = quadClipped.minXMinYFace.getBilinearFiltered( 0, 0, -1, -1 ) +
                               quadClipped.minXMaxYFace.getBilinearFiltered( 0, 0, -1, 0 ) +
                               quadClipped.maxXMinYFace.getBilinearFiltered( 0, 0, 0, -1 ) +
                               quadClipped.maxXMaxYFace.getBilinearFiltered( 0, 0, 0, 0 );
              }
              else if ( context.polygonFiltering === PolygonFilterType.MitchellNetravali ) {
                const minMinQuad = quadClip( quadClipped.minXMinYFace, -1, -1 );
                const minMaxQuad = quadClip( quadClipped.minXMaxYFace, -1, 1 );
                const maxMinQuad = quadClip( quadClipped.maxXMinYFace, 1, -1 );
                const maxMaxQuad = quadClip( quadClipped.maxXMaxYFace, 1, 1 );

                contribution = minMinQuad.minXMinYFace.getMitchellNetravaliFiltered( 0, 0, -2, -2 ) +
                               minMinQuad.minXMaxYFace.getMitchellNetravaliFiltered( 0, 0, -2, -1 ) +
                               minMinQuad.maxXMinYFace.getMitchellNetravaliFiltered( 0, 0, -1, -2 ) +
                               minMinQuad.maxXMaxYFace.getMitchellNetravaliFiltered( 0, 0, -1, -1 ) +
                               minMaxQuad.minXMinYFace.getMitchellNetravaliFiltered( 0, 0, -2, 0 ) +
                               minMaxQuad.minXMaxYFace.getMitchellNetravaliFiltered( 0, 0, -2, 1 ) +
                               minMaxQuad.maxXMinYFace.getMitchellNetravaliFiltered( 0, 0, -1, 0 ) +
                               minMaxQuad.maxXMaxYFace.getMitchellNetravaliFiltered( 0, 0, -1, 1 ) +
                               maxMinQuad.minXMinYFace.getMitchellNetravaliFiltered( 0, 0, 0, -2 ) +
                               maxMinQuad.minXMaxYFace.getMitchellNetravaliFiltered( 0, 0, 0, -1 ) +
                               maxMinQuad.maxXMinYFace.getMitchellNetravaliFiltered( 0, 0, 1, -2 ) +
                               maxMinQuad.maxXMaxYFace.getMitchellNetravaliFiltered( 0, 0, 1, -1 ) +
                               maxMaxQuad.minXMinYFace.getMitchellNetravaliFiltered( 0, 0, 0, 0 ) +
                               maxMaxQuad.minXMaxYFace.getMitchellNetravaliFiltered( 0, 0, 0, 1 ) +
                               maxMaxQuad.maxXMinYFace.getMitchellNetravaliFiltered( 0, 0, 1, 0 ) +
                               maxMaxQuad.maxXMaxYFace.getMitchellNetravaliFiltered( 0, 0, 1, 1 );
              }
            }

            context.outputRaster.addClientPartialPixel( color.timesScalar( contribution ), x + context.outputRasterOffset.x, y + context.outputRasterOffset.y );
          }
          else {
            const transformMatrix = descaleMatrix.timesMatrix( Matrix3.translation( -( x + 0.5 ), -( y + 0.5 ) ) );
            const inverseMatrix = transformMatrix.inverted();
            const unitFace = clippedFace.getTransformed( transformMatrix );

            const splitAndProcessFace = ( ux: number, uy: number, face: ClippableFace, getContribution: ( f: ClippableFace ) => number ) => {
              const area = face.getArea();

              // TODO: performance is killed here, hopefully we don't really need it
              const minVector = inverseMatrix.timesVector2( new Vector2( ux, uy ) );
              const maxVector = inverseMatrix.timesVector2( new Vector2( ux + 1, uy + 1 ) );

              if ( area > 1e-8 ) {
                // TODO: SPLIT THIS
                const transformedArea = area * filterArea;
                const transformedFace = face.getTransformed( inverseMatrix );
                const transformedMinX = minVector.x;
                const transformedMinY = minVector.y;
                const transformedMaxX = maxVector.x;
                const transformedMaxY = maxVector.y;

                const binary = ( tFace: ClippableFace, tArea: number, tMinX: number, tMinY: number, tMaxX: number, tMaxY: number ) => {
                  const averageX = 0.5 * ( tMinX + tMaxX );
                  const averageY = 0.5 * ( tMinY + tMaxY );
                  if ( tMaxX - tMinX > 1 ) {
                    const { minFace, maxFace } = tFace.getBinaryXClip( averageX, averageY );
                    const minArea = minFace.getArea();
                    const maxArea = maxFace.getArea();

                    if ( minArea > 1e-8 ) {
                      binary( minFace, minArea, tMinX, tMinY, averageX, tMaxY );
                    }
                    if ( maxArea > 1e-8 ) {
                      binary( maxFace, maxArea, averageX, tMinY, tMaxX, tMaxY );
                    }
                  }
                  else if ( tMaxY - tMinY > 1 ) {
                    const { minFace, maxFace } = tFace.getBinaryYClip( averageY, averageX );
                    const minArea = minFace.getArea();
                    const maxArea = maxFace.getArea();

                    if ( minArea > 1e-8 ) {
                      binary( minFace, minArea, tMinX, tMinY, tMaxX, averageY );
                    }
                    if ( maxArea > 1e-8 ) {
                      binary( maxFace, maxArea, tMinX, averageY, tMaxX, tMaxY );
                    }
                  }
                  else {
                    const color = context.evaluate!( scratchEvaluationContext.set(
                      tFace,
                      context.needs.needsArea ? tArea : NaN, // NaNs to hopefully hard-error
                      context.needs.needsCentroid ? tFace.getCentroid( tArea ) : nanVector,
                      tMinX, tMinY, tMaxX, tMaxY
                    ), scratchEvaluationOutputVector );
                    context.outputRaster.addClientPartialPixel( color.timesScalar( getContribution( tFace.getTransformed( transformMatrix ) ) ), x + context.outputRasterOffset.x, y + context.outputRasterOffset.y );
                  }
                };
                binary( transformedFace, transformedArea, transformedMinX, transformedMinY, transformedMaxX, transformedMaxY );
              }
            };

            if ( context.polygonFiltering === PolygonFilterType.Box ) {
              splitAndProcessFace( -0.5, -0.5, unitFace, face => face.getArea() );
            }
            else if ( context.polygonFiltering === PolygonFilterType.Bilinear ) {
              const quadClipped = quadClip( unitFace, 0, 0 );
              splitAndProcessFace( -1, -1, quadClipped.minXMinYFace, f => f.getBilinearFiltered( 0, 0, -1, -1 ) );
              splitAndProcessFace( -1, 0, quadClipped.minXMaxYFace, f => f.getBilinearFiltered( 0, 0, -1, 0 ) );
              splitAndProcessFace( 0, -1, quadClipped.maxXMinYFace, f => f.getBilinearFiltered( 0, 0, 0, -1 ) );
              splitAndProcessFace( 0, 0, quadClipped.maxXMaxYFace, f => f.getBilinearFiltered( 0, 0, 0, 0 ) );
            }
            else if ( context.polygonFiltering === PolygonFilterType.MitchellNetravali ) {
              const quadClipped = quadClip( unitFace, 0, 0 );

              const minMinQuad = quadClip( quadClipped.minXMinYFace, -1, -1 );
              const minMaxQuad = quadClip( quadClipped.minXMaxYFace, -1, 1 );
              const maxMinQuad = quadClip( quadClipped.maxXMinYFace, 1, -1 );
              const maxMaxQuad = quadClip( quadClipped.maxXMaxYFace, 1, 1 );

              // TODO: can factor out constants?
              splitAndProcessFace( -2, -2, minMinQuad.minXMinYFace, f => f.getMitchellNetravaliFiltered( 0, 0, -2, -2 ) );
              splitAndProcessFace( -2, -1, minMinQuad.minXMaxYFace, f => f.getMitchellNetravaliFiltered( 0, 0, -2, -1 ) );
              splitAndProcessFace( -1, -2, minMinQuad.maxXMinYFace, f => f.getMitchellNetravaliFiltered( 0, 0, -1, -2 ) );
              splitAndProcessFace( -1, -1, minMinQuad.maxXMaxYFace, f => f.getMitchellNetravaliFiltered( 0, 0, -1, -1 ) );
              splitAndProcessFace( -2, 0, minMaxQuad.minXMinYFace, f => f.getMitchellNetravaliFiltered( 0, 0, -2, 0 ) );
              splitAndProcessFace( -2, 1, minMaxQuad.minXMaxYFace, f => f.getMitchellNetravaliFiltered( 0, 0, -2, 1 ) );
              splitAndProcessFace( -1, 0, minMaxQuad.maxXMinYFace, f => f.getMitchellNetravaliFiltered( 0, 0, -1, 0 ) );
              splitAndProcessFace( -1, 1, minMaxQuad.maxXMaxYFace, f => f.getMitchellNetravaliFiltered( 0, 0, -1, 1 ) );
              splitAndProcessFace( 0, -2, maxMinQuad.minXMinYFace, f => f.getMitchellNetravaliFiltered( 0, 0, 0, -2 ) );
              splitAndProcessFace( 0, -1, maxMinQuad.minXMaxYFace, f => f.getMitchellNetravaliFiltered( 0, 0, 0, -1 ) );
              splitAndProcessFace( 1, -2, maxMinQuad.maxXMinYFace, f => f.getMitchellNetravaliFiltered( 0, 0, 1, -2 ) );
              splitAndProcessFace( 1, -1, maxMinQuad.maxXMaxYFace, f => f.getMitchellNetravaliFiltered( 0, 0, 1, -1 ) );
              splitAndProcessFace( 0, 0, maxMaxQuad.minXMinYFace, f => f.getMitchellNetravaliFiltered( 0, 0, 0, 0 ) );
              splitAndProcessFace( 0, 1, maxMaxQuad.minXMaxYFace, f => f.getMitchellNetravaliFiltered( 0, 0, 0, 1 ) );
              splitAndProcessFace( 1, 0, maxMaxQuad.maxXMinYFace, f => f.getMitchellNetravaliFiltered( 0, 0, 1, 0 ) );
              splitAndProcessFace( 1, 1, maxMaxQuad.maxXMaxYFace, f => f.getMitchellNetravaliFiltered( 0, 0, 1, 1 ) );
            }
          }
        }
      }
    }
  }

  public static rasterizeAccumulate(
    outputRaster: OutputRaster,
    renderableFaces: RenderableFace[],
    bounds: Bounds2,
    contributionBounds: Bounds2,
    outputRasterOffset: Vector2,
    polygonFiltering: PolygonFilterType,
    polygonFilterWindowMultiplier: number,
    executionMethod: RenderExecutionMethod,
    log: RasterLog | null
  ): void {
    const executor = new RenderExecutor();

    for ( let i = 0; i < renderableFaces.length; i++ ) {
      const renderableFace = renderableFaces[ i ];
      const renderProgram = renderableFace.renderProgram;
      const polygonalBounds = renderableFace.bounds;

      // TODO: be really careful about the colorConverter... the copy() missing already hit me once.
      const constClientColor = renderProgram instanceof RenderColor ? renderProgram.color : null;
      const constOutputColor = constClientColor !== null ? outputRaster.colorConverter.clientToOutput( constClientColor ).copy() : null;

      let evaluator: RenderEvaluator | null = null;
      if ( !constOutputColor ) {
        if ( executionMethod === 'instructions' ) {
          executor.loadRenderProgram( renderProgram );
          evaluator = executor.evaluator;
        }
        else {
          assert && assert( executionMethod === 'evaluation' );

          evaluator = renderProgram.getEvaluator();
        }
      }

      const context = new RasterizationContext(
        outputRaster,
        evaluator,
        constClientColor,
        constOutputColor,
        outputRasterOffset,
        bounds,
        polygonFiltering,
        polygonFilterWindowMultiplier,
        renderProgram.getNeeds(),
        log
      );

      if ( polygonFilterWindowMultiplier !== 1 ) {
        const clipped = renderableFace.face.getClipped(
          contributionBounds.minX, contributionBounds.minY, contributionBounds.maxX, contributionBounds.maxY
        );
        Rasterize.windowedFilterRasterize( context, clipped, polygonalBounds.intersection( contributionBounds ) );
      }
      else {
        // For filtering, we'll want to round our faceBounds to the nearest (shifted) integer.
        const gridOffset = getPolygonFilterGridOffset( context.polygonFiltering );
        const faceBounds = polygonalBounds.intersection( contributionBounds ).shiftedXY( gridOffset, gridOffset ).roundedOut().shiftedXY( -gridOffset, -gridOffset );

        // We will clip off anything outside the "bounds", since if we're based on EdgedFace we don't want those "fake"
        // edges that might be outside.
        const clippableFace = renderableFace.face.getClipped(
          faceBounds.minX, faceBounds.minY, faceBounds.maxX, faceBounds.maxY
        );

        Rasterize.binaryRasterize(
          context, clippableFace, clippableFace.getArea(), faceBounds.minX, faceBounds.minY, faceBounds.maxX, faceBounds.maxY
        );
      }
    }
  }

  public static markStart( name: string ): void {
    window.performance && window.performance.mark( `${name}-start` );
  }

  public static markEnd( name: string ): void {
    window.performance && window.performance.mark( `${name}-end` );
    window.performance && window.performance.measure( name, `${name}-start`, `${name}-end` );
  }

  public static partitionRenderableFaces(
    renderProgram: RenderProgram,
    bounds: Bounds2,
    providedOptions?: RasterizationOptions
  ): RenderableFace[] {

    // Coordinate frames:
    //
    // First, we start with the RenderProgram coordinate frame (the coordinate frame of the paths inside the renderPrograms,
    // and the bounds provided to us.
    //
    // We will then transfer over to the "integer" coordinate frame, where each of our input edges will have
    // integer-valued coordinates. Additionally, we've shifted/scaled this, so that the integers lie within about
    // 20-bits of precision (and are centered in the integer grid). We do this so that we can do exact operations for
    // intersection/etc., which solves most of the robustness issues (the intersection point x,y between two of these
    // line segments can be stored each with a 64-bit numerator and a 64-bit denominator, and we can do the needed
    // arithmetic with the rationals).
    //
    // Once we have determined the intersections AND connected half-edges (which requires sorting the half-edges with
    // the exact values), we can then transfer back to the RenderProgram coordinate frame, and rasterize the faces
    // in this coordinate frame.
    //
    // Of note, when we're filtering with bilinear or Mitchell-Netravali filters, we'll be cutting up the faces into
    // half-pixel offset expanded regions, so that we can evaluate the filters AT the pixel centers.

    assert && assert( bounds.isValid() && !bounds.isEmpty(), 'Rasterization bounds should be valid and non-empty' );
    assert && assert( Number.isInteger( bounds.left ) && Number.isInteger( bounds.top ) && Number.isInteger( bounds.right ) && Number.isInteger( bounds.bottom ) );

    // Just simplify things off-the-bat, so we don't need as much computation
    renderProgram = renderProgram.simplified();

    const options = optionize3<RasterizationOptions>()( {}, DEFAULT_OPTIONS, providedOptions );

    const log = options.log;

    const scratchAccumulator = {
      polygonal: PolygonalFace.getScratchAccumulator(),
      edged: EdgedFace.getScratchAccumulator(),
      edgedClipped: EdgedClippedFace.getScratchAccumulator()
    }[ options.renderableFaceType ];

    const polygonFiltering: PolygonFilterType = options.polygonFiltering;
    const polygonFilterWindowMultiplier = options.polygonFilterWindowMultiplier;

    const paths = new Set<RenderPath>();
    renderProgram.depthFirst( program => {
      // TODO: we can filter based on hasPathBoolean, so we can skip subtrees
      if ( program instanceof RenderPathBoolean ) {
        paths.add( program.path );
      }
    } );
    const backgroundPath = new RenderPath( 'nonzero', [
      [
        bounds.leftTop,
        bounds.rightTop,
        bounds.rightBottom,
        bounds.leftBottom
      ]
    ] );
    paths.add( backgroundPath );

    // The potentially filter-expanded bounds of content that could potentially affect pixels within our `bounds`,
    // in the RenderProgram coordinate frame.
    const contributionBounds = getPolygonFilterGridBounds( bounds, polygonFiltering, polygonFilterWindowMultiplier );

    log && Rasterize.markStart( 'path-bounds' );
    const boundedSubpaths = BoundedSubpath.fromPathSet( paths );
    log && Rasterize.markEnd( 'path-bounds' );

    // Keep us at 20 bits of precision (after rounding)
    const tileSize = options.tileSize;
    const maxSize = Math.min( tileSize, Math.max( contributionBounds.width, contributionBounds.height ) );
    const scale = Math.pow( 2, 20 - Math.ceil( Math.log2( maxSize ) ) );
    if ( log ) { log.scale = scale; }

    const combinedRenderableFaces: RenderableFace[] = [];
    for ( let y = contributionBounds.minY; y < contributionBounds.maxY; y += tileSize ) {
      for ( let x = contributionBounds.minX; x < contributionBounds.maxX; x += tileSize ) {
        const tileLog = log ? new RasterTileLog() : null;
        if ( log && tileLog ) { log.tileLogs.push( tileLog ); }

        // A slice of our contributionBounds
        const tileBounds = new Bounds2(
          x,
          y,
          Math.min( x + tileSize, contributionBounds.maxX ),
          Math.min( y + tileSize, contributionBounds.maxY )
        );

        // -( scale * ( tileBounds.minX + filterGridOffset.x ) + translation.x ) = scale * ( tileBounds.maxX + filterGridOffset.x ) + translation.x
        const translation = new Vector2(
          -0.5 * scale * ( tileBounds.minX + tileBounds.maxX ),
          -0.5 * scale * ( tileBounds.minY + tileBounds.maxY )
        );
        if ( tileLog ) { tileLog.translation = translation; }

        const toIntegerMatrix = Matrix3.affine( scale, 0, translation.x, 0, scale, translation.y );
        if ( tileLog ) { tileLog.toIntegerMatrix = toIntegerMatrix; }

        const fromIntegerMatrix = toIntegerMatrix.inverted();
        if ( tileLog ) { tileLog.fromIntegerMatrix = fromIntegerMatrix; }

        // Verify our math! Make sure we will be perfectly centered in our integer grid!
        assert && assert( Math.abs( ( scale * tileBounds.minX + translation.x ) + ( scale * tileBounds.maxX + translation.x ) ) < 1e-10 );
        assert && assert( Math.abs( ( scale * tileBounds.minY + translation.y ) + ( scale * tileBounds.maxY + translation.y ) ) < 1e-10 );

        log && Rasterize.markStart( 'clip-integer' );
        const integerEdges = IntegerEdge.clipScaleToIntegerEdges( boundedSubpaths, tileBounds, toIntegerMatrix );
        log && Rasterize.markEnd( 'clip-integer' );
        if ( tileLog ) { tileLog.integerEdges = integerEdges; }

        log && Rasterize.markStart( 'integer-sort' );
        // NOTE: Can also be 'none', we'll no-op
        if ( options.edgeIntersectionSortMethod === 'center-size' ) {
          HilbertMapping.sortCenterSize( integerEdges, 1 / ( scale * maxSize ) );
        }
        else if ( options.edgeIntersectionSortMethod === 'min-max' ) {
          HilbertMapping.sortMinMax( integerEdges, 1 / ( scale * maxSize ) );
        }
        else if ( options.edgeIntersectionSortMethod === 'min-max-size' ) {
          HilbertMapping.sortMinMaxSize( integerEdges, 1 / ( scale * maxSize ) );
        }
        else if ( options.edgeIntersectionSortMethod === 'center-min-max' ) {
          HilbertMapping.sortCenterMinMax( integerEdges, 1 / ( scale * maxSize ) );
        }
        else if ( options.edgeIntersectionSortMethod === 'random' ) {
          // NOTE: This is NOT designed for performance (it's for testing)
          // eslint-disable-next-line phet/bad-sim-text
          const shuffled = _.shuffle( integerEdges );
          integerEdges.length = 0;
          integerEdges.push( ...shuffled );
        }
        log && Rasterize.markEnd( 'integer-sort' );

        log && Rasterize.markStart( 'integer-intersect' );
        if ( options.edgeIntersectionMethod === 'quadratic' ) {
          LineIntersector.edgeIntersectionQuadratic( integerEdges, tileLog );
        }
        else if ( options.edgeIntersectionMethod === 'boundsTree' ) {
          LineIntersector.edgeIntersectionBoundsTree( integerEdges, tileLog );
        }
        else if ( options.edgeIntersectionMethod === 'arrayBoundsTree' ) {
          LineIntersector.edgeIntersectionArrayBoundsTree( integerEdges, tileLog );
        }
        else {
          throw new Error( `unknown edgeIntersectionMethod: ${options.edgeIntersectionMethod}` );
        }
        log && Rasterize.markEnd( 'integer-intersect' );

        log && Rasterize.markStart( 'integer-split' );
        const rationalHalfEdges = LineSplitter.splitIntegerEdges( integerEdges );
        log && Rasterize.markEnd( 'integer-split' );

        log && Rasterize.markStart( 'edge-sort' );
        rationalHalfEdges.sort( ( a, b ) => a.compare( b ) );
        log && Rasterize.markEnd( 'edge-sort' );

        log && Rasterize.markStart( 'filter-connect' );
        let filteredRationalHalfEdges = RationalHalfEdge.filterAndConnectHalfEdges( rationalHalfEdges );
        log && Rasterize.markEnd( 'filter-connect' );
        if ( tileLog ) { tileLog.filteredRationalHalfEdges = filteredRationalHalfEdges; }

        const innerBoundaries: RationalBoundary[] = [];
        const outerBoundaries: RationalBoundary[] = [];
        const faces: RationalFace[] = [];
        if ( tileLog ) {
          tileLog.innerBoundaries = innerBoundaries;
          tileLog.outerBoundaries = outerBoundaries;
          tileLog.faces = faces;
        }
        log && Rasterize.markStart( 'trace-boundaries' );
        filteredRationalHalfEdges = RationalFace.traceBoundaries( filteredRationalHalfEdges, innerBoundaries, outerBoundaries, faces );
        log && Rasterize.markEnd( 'trace-boundaries' );
        if ( tileLog ) { tileLog.refilteredRationalHalfEdges = filteredRationalHalfEdges; }

        log && Rasterize.markStart( 'face-holes' );
        const exteriorBoundaries = RationalFace.computeFaceHolesWithOrderedWindingNumbers(
          outerBoundaries,
          faces
        );
        log && Rasterize.markEnd( 'face-holes' );
        assert && assert( exteriorBoundaries.length === 1, 'Should only have one external boundary, due to background' );
        const exteriorBoundary = exteriorBoundaries[ 0 ];

        // For ease of use, an unbounded face (it is essentially fake)
        const unboundedFace = RationalFace.createUnboundedFace( exteriorBoundary );
        if ( tileLog ) { tileLog.unboundedFace = unboundedFace; }

        log && Rasterize.markStart( 'winding-maps' );
        RationalFace.computeWindingMaps( filteredRationalHalfEdges, unboundedFace );
        log && Rasterize.markEnd( 'winding-maps' );

        log && Rasterize.markStart( 'render-programs' );
        const renderedFaces = Rasterize.getRenderProgrammedFaces( renderProgram, faces );
        if ( tileLog ) { tileLog.renderedFaces = renderedFaces; }
        log && Rasterize.markEnd( 'render-programs' );

        log && Rasterize.markStart( 'renderable-faces' );
        let renderableFaces: RenderableFace[];

        // Set up the correct bounds in case we use edgedClipped.
        scratchAccumulator.setAccumulationBounds( tileBounds.minX, tileBounds.minY, tileBounds.maxX, tileBounds.maxY );

        if ( options.renderableFaceMethod === 'simple' ) {
          renderableFaces = FaceConversion.toSimpleRenderableFaces( renderedFaces, fromIntegerMatrix, scratchAccumulator );
        }
        else if ( options.renderableFaceMethod === 'fullyCombined' ) {
          renderableFaces = FaceConversion.toFullyCombinedRenderableFaces( renderedFaces, fromIntegerMatrix, scratchAccumulator );
        }
        else if ( options.renderableFaceMethod === 'simplifyingCombined' ) {
          assert && assert( options.renderableFaceType !== 'polygonal', 'simplifyingCombined does not sort data for polygonal output' );
          renderableFaces = FaceConversion.toSimplifyingCombinedRenderableFaces( renderedFaces, fromIntegerMatrix, scratchAccumulator );
        }
        else if ( options.renderableFaceMethod === 'traced' ) {
          renderableFaces = FaceConversion.toTracedRenderableFaces( renderedFaces, fromIntegerMatrix, scratchAccumulator );
        }
        else {
          throw new Error( 'unknown renderableFaceMethod' );
        }

        log && Rasterize.markEnd( 'renderable-faces' );
        if ( tileLog ) { tileLog.initialRenderableFaces = renderableFaces; }

        if ( options.splitPrograms ) {
          log && Rasterize.markStart( 'split-programs' );
          renderableFaces = renderableFaces.flatMap( face => face.split() );
          log && Rasterize.markEnd( 'split-programs' );
        }
        if ( tileLog ) { tileLog.renderableFaces = renderableFaces; }

        // TODO: If we had a RenderDepthSort, do a face combination here?

        combinedRenderableFaces.push( ...renderableFaces );
      }
    }

    if ( log ) { log.renderableFaces = combinedRenderableFaces; }

    return combinedRenderableFaces;
  }

  public static rasterize(
    renderProgram: RenderProgram,
    outputRaster: OutputRaster,
    bounds: Bounds2,
    providedOptions?: RasterizationOptions
  ): void {

    const options = optionize3<RasterizationOptions>()( {}, DEFAULT_OPTIONS, providedOptions );

    const log = options.log;

    const renderableFaces = Rasterize.partitionRenderableFaces( renderProgram, bounds, providedOptions );

    const polygonFiltering: PolygonFilterType = options.polygonFiltering;
    const polygonFilterWindowMultiplier = options.polygonFilterWindowMultiplier;

    // The potentially filter-expanded bounds of content that could potentially affect pixels within our `bounds`,
    // in the RenderProgram coordinate frame.
    const contributionBounds = getPolygonFilterGridBounds( bounds, polygonFiltering, polygonFilterWindowMultiplier );

    log && Rasterize.markStart( 'rasterize-accumulate' );
    Rasterize.rasterizeAccumulate(
      outputRaster,
      renderableFaces,
      bounds,
      contributionBounds,
      options.outputRasterOffset,
      polygonFiltering,
      polygonFilterWindowMultiplier,
      options.executionMethod,
      log
    );
    log && Rasterize.markEnd( 'rasterize-accumulate' );
  }

  public static imageDataToCanvas( imageData: ImageData ): HTMLCanvasElement {
    const canvas = document.createElement( 'canvas' );
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const context = ( imageData.colorSpace && imageData.colorSpace !== 'srgb' ) ?
                    canvas.getContext( '2d', { colorSpace: imageData.colorSpace } )! :
                    canvas.getContext( '2d' )!;
    context.putImageData( imageData, 0, 0 );
    return canvas;
  }

  public static writeImageDataToCanvas( imageData: ImageData, canvas: HTMLCanvasElement, context: CanvasRenderingContext2D ): void {
    if ( canvas.width !== imageData.width ) {
      canvas.width = imageData.width;
    }
    if ( canvas.height !== imageData.height ) {
      canvas.height = imageData.height;
    }
    context.putImageData( imageData, 0, 0 );
  }
}

alpenglow.register( 'Rasterize', Rasterize );