// Copyright 2023-2025, University of Colorado Boulder

/**
 * We do the following:
 *
 * 1. Binary clip each RasterEdge into two RasterEdgeClips (one for each side of the split)
 * 2. Take these, do a segmented parallel reduction, and
 * 3. During reduction, store associated data to the RasterClippedChunks (precisely when we have reduced all of the
 *    edges for a particular chunk)
 *
 * NOTE: The reduction is also completed in ParallelRasterChunkReduce, so if changing this file, please check there too
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import Vector2 from '../../../../dot/js/Vector2.js';
import { alpenglow } from '../../alpenglow.js';
import type { ParallelStorageArray } from '../ParallelStorageArray.js';
import type { RasterChunk } from './RasterChunk.js';
import type { RasterEdge } from './RasterEdge.js';
import type { RasterClippedChunk } from './RasterClippedChunk.js';
import { RasterEdgeClip } from './RasterEdgeClip.js';
import { RasterChunkReduceQuad } from './RasterChunkReduceQuad.js';
import { RasterChunkReducePair } from './RasterChunkReducePair.js';
import { ParallelWorkgroupArray } from '../ParallelWorkgroupArray.js';
import { ParallelKernel } from '../ParallelKernel.js';
import { RasterChunkReduceData } from './RasterChunkReduceData.js';
import { ParallelExecutor } from '../ParallelExecutor.js';

export class ParallelRasterInitialClip {
  public static async dispatch(
    workgroupSize: number,

    // read
    chunks: ParallelStorageArray<RasterChunk>,
    edges: ParallelStorageArray<RasterEdge>,
    numEdges: number,

    // read-write
    clippedChunks: ParallelStorageArray<RasterClippedChunk>, // Our reduce will "apply" to this, writing associated data

    // write
    edgeClips: ParallelStorageArray<RasterEdgeClip>,
    chunkReduces: ParallelStorageArray<RasterChunkReduceQuad>,
    debugFullChunkReduces: ParallelStorageArray<RasterChunkReducePair>
  ): Promise<void> {
    const logWorkgroupSize = Math.log2( workgroupSize );

    type WorkgroupValues = {
      reduces: ParallelWorkgroupArray<RasterChunkReducePair>;

      // Stores the first chunk index for the workgroup. We'll use this to compute the atomicMaxFirstChunkIndex
      firstChunkIndex: ParallelWorkgroupArray<number>; // NOT an array, just using that for atomics. one element, u32

      // The maximum (localId.x) that has the same chunkIndex as localId.x===0.
      // We'll need this to compute this so we can deliver the "left" values for future reduction.
      atomicMaxFirstChunkIndex: number;
    };

    const kernel = new ParallelKernel<WorkgroupValues>( async context => {
      await context.start();

      const edgeIndex = context.globalId.x;
      const exists = edgeIndex < numEdges;

      const edge = await edges.get( context, edgeIndex );
      const chunk = await chunks.get( context, edge.chunkIndex );

      // We'll workgroupBarrier at least once below, before this is relevant
      if ( exists && context.localId.x === 0 ) {
        await context.workgroupValues.firstChunkIndex.set( context, 0, edge.chunkIndex );
      }

      // We want to map [offset, offset + num] edgeIndices to [2*offset, 2*offset + num] (min) and [2*offset + num, 2*offset + 2*num] (max)
      // So we add `offset` to min, and `offset + num` to max
      const minEdgeIndex = chunk.edgesOffset + edgeIndex;
      const maxEdgeIndex = chunk.edgesOffset + chunk.numEdges + edgeIndex;
      const minClippedChunkIndex = 2 * edge.chunkIndex;
      const maxClippedChunkIndex = 2 * edge.chunkIndex + 1;

      /*************************************************************************
       * CLIPPING
       *************************************************************************/

      const xDiff = chunk.maxX - chunk.minX;
      const yDiff = chunk.maxY - chunk.minY;

      const isXSplit = xDiff > yDiff;

      // NOTE: This is set up so that if we have a half-pixel offset e.g. with a bilinear filter, it will work)
      // NOTE: Duplicated in ParallelRasterInitialClip and ParallelRasterInitialChunk
      const split = isXSplit ? chunk.minX + Math.floor( 0.5 * xDiff ) : chunk.minY + Math.floor( 0.5 * yDiff );

      // NOTE: We're combining both the x-clip and y-clip into concurrent code, so we don't get divergence between
      // invocations/threads.
      // if isXSplit, then x is primary, y is secondary
      // if !isXSplit, then y is primary, x is secondary

      const minPoint0 = new Vector2( 0, 0 );
      const minPoint1 = new Vector2( 0, 0 );
      const minPoint2 = new Vector2( 0, 0 );
      const minPoint3 = new Vector2( 0, 0 );

      const maxPoint0 = new Vector2( 0, 0 );
      const maxPoint1 = new Vector2( 0, 0 );
      const maxPoint2 = new Vector2( 0, 0 );
      const maxPoint3 = new Vector2( 0, 0 );

      let minCount = 0;
      let maxCount = 0;
      let minSet = true;
      let maxSet = true;

      const centerSecondary = 0.5 * ( isXSplit ? chunk.minY + chunk.maxY : chunk.minX + chunk.maxX );
      const startPoint = edge.startPoint;
      const endPoint = edge.endPoint;

      // TODO: with fastmath, will these be equivalent?
      const startPrimaryCmp = Math.sign( ( isXSplit ? startPoint.x : startPoint.y ) - split );
      const endPrimaryCmp = Math.sign( ( isXSplit ? endPoint.x : endPoint.y ) - split );
      const startSecondaryLess = ( isXSplit ? startPoint.y : startPoint.x ) < centerSecondary;
      const endSecondaryLess = ( isXSplit ? endPoint.y : endPoint.x ) < centerSecondary;

      if ( startPrimaryCmp === endPrimaryCmp ) {
        // both values less than the split
        if ( startPrimaryCmp === -1 ) {
          minPoint0.set( edge.startPoint );
          minPoint1.set( edge.endPoint );
          minPoint2.set( edge.endPoint );
          minPoint3.set( edge.endPoint );
          maxSet = false;

          if ( startSecondaryLess !== endSecondaryLess ) {
            maxCount += startSecondaryLess ? 1 : -1;
          }
        }
        // both values greater than the split
        else if ( startPrimaryCmp === 1 ) {
          maxPoint0.set( edge.startPoint );
          maxPoint1.set( edge.endPoint );
          maxPoint2.set( edge.endPoint );
          maxPoint3.set( edge.endPoint );
          minSet = false;

          if ( startSecondaryLess !== endSecondaryLess ) {
            minCount += startSecondaryLess ? 1 : -1;
          }
        }
        // both values equal to the split
        else if ( startPrimaryCmp === 0 ) {
          // vertical/horizontal line ON our clip point. It is considered "inside" both, so we can just simply push it to both
          minPoint0.set( edge.startPoint );
          minPoint1.set( edge.endPoint );
          minPoint2.set( edge.endPoint );
          minPoint3.set( edge.endPoint );

          maxPoint0.set( edge.startPoint );
          maxPoint1.set( edge.endPoint );
          maxPoint2.set( edge.endPoint );
          maxPoint3.set( edge.endPoint );
        }
      }
      else {
        // There is a single crossing of our x (possibly on a start or end point)
        const secondaryIntersection = isXSplit
          ? startPoint.y + ( endPoint.y - startPoint.y ) * ( split - startPoint.x ) / ( endPoint.x - startPoint.x )
          : startPoint.x + ( endPoint.x - startPoint.x ) * ( split - startPoint.y ) / ( endPoint.y - startPoint.y );
        const intersection = isXSplit ? new Vector2( split, secondaryIntersection ) : new Vector2( secondaryIntersection, split );

        const startLess = startPrimaryCmp === -1;
        const startGreater = startPrimaryCmp === 1;
        const endLess = endPrimaryCmp === -1;
        const endGreater = endPrimaryCmp === 1;

        const minResultStartPoint = startLess ? startPoint : intersection;
        const minResultEndPoint = endLess ? endPoint : intersection;
        const maxResultStartPoint = startGreater ? startPoint : intersection;
        const maxResultEndPoint = endGreater ? endPoint : intersection;

        const minSecondary = isXSplit ? chunk.minY : chunk.minX;
        const maxSecondary = isXSplit ? chunk.maxY : chunk.maxX;
        const startCornerSecondary = startSecondaryLess ? minSecondary : maxSecondary;
        const endCornerSecondary = endSecondaryLess ? minSecondary : maxSecondary;

        minPoint0.set( startGreater ? (
          isXSplit ? new Vector2( split, startCornerSecondary ) : new Vector2( startCornerSecondary, split )
        ) : minResultStartPoint );
        minPoint1.set( minResultStartPoint );
        minPoint2.set( minResultEndPoint );
        minPoint3.set( endGreater ? (
          isXSplit ? new Vector2( split, endCornerSecondary ) : new Vector2( endCornerSecondary, split )
        ) : minResultEndPoint );

        maxPoint0.set( startLess ? (
          isXSplit ? new Vector2( split, startCornerSecondary ) : new Vector2( startCornerSecondary, split )
        ) : maxResultStartPoint );
        maxPoint1.set( maxResultStartPoint );
        maxPoint2.set( maxResultEndPoint );
        maxPoint3.set( endLess ? (
          isXSplit ? new Vector2( split, endCornerSecondary ) : new Vector2( endCornerSecondary, split )
        ) : maxResultEndPoint );
      }

      const veryPositiveNumber = 1e10;
      const veryNegativeNumber = -1e10;

      const minClip = new RasterEdgeClip( minClippedChunkIndex, minPoint0, minPoint1, minPoint2, minPoint3, edge.isFirstEdge, edge.isLastEdge );
      const maxClip = new RasterEdgeClip( maxClippedChunkIndex, maxPoint0, maxPoint1, maxPoint2, maxPoint3, edge.isFirstEdge, edge.isLastEdge );

      const minArea = minClip.getArea();
      const maxArea = maxClip.getArea();

      let minBoundsMinX = minSet ? Math.min( minPoint0.x, minPoint1.x, minPoint2.x, minPoint3.x ) : veryPositiveNumber;
      let minBoundsMinY = minSet ? Math.min( minPoint0.y, minPoint1.y, minPoint2.y, minPoint3.y ) : veryPositiveNumber;
      let minBoundsMaxX = minSet ? Math.max( minPoint0.x, minPoint1.x, minPoint2.x, minPoint3.x ) : veryNegativeNumber;
      let minBoundsMaxY = minSet ? Math.max( minPoint0.y, minPoint1.y, minPoint2.y, minPoint3.y ) : veryNegativeNumber;

      if ( minCount !== 0 ) {
        if ( isXSplit ) {
          minBoundsMaxX = Math.max( minBoundsMaxX, split );
          minBoundsMinY = Math.min( minBoundsMinY, chunk.minY );
          minBoundsMaxY = Math.max( minBoundsMaxY, chunk.maxY );
        }
        else {
          minBoundsMaxY = Math.max( minBoundsMaxY, split );
          minBoundsMinX = Math.min( minBoundsMinX, chunk.minX );
          minBoundsMaxX = Math.max( minBoundsMaxX, chunk.maxX );
        }
      }

      let maxBoundsMinX = maxSet ? Math.min( maxPoint0.x, maxPoint1.x, maxPoint2.x, maxPoint3.x ) : veryPositiveNumber;
      let maxBoundsMinY = maxSet ? Math.min( maxPoint0.y, maxPoint1.y, maxPoint2.y, maxPoint3.y ) : veryPositiveNumber;
      let maxBoundsMaxX = maxSet ? Math.max( maxPoint0.x, maxPoint1.x, maxPoint2.x, maxPoint3.x ) : veryNegativeNumber;
      let maxBoundsMaxY = maxSet ? Math.max( maxPoint0.y, maxPoint1.y, maxPoint2.y, maxPoint3.y ) : veryNegativeNumber;

      if ( maxCount !== 0 ) {
        if ( isXSplit ) {
          maxBoundsMinX = Math.min( maxBoundsMinX, split );
          maxBoundsMinY = Math.min( maxBoundsMinY, chunk.minY );
          maxBoundsMaxY = Math.max( maxBoundsMaxY, chunk.maxY );
        }
        else {
          maxBoundsMinY = Math.min( maxBoundsMinY, split );
          maxBoundsMinX = Math.min( maxBoundsMinX, chunk.minX );
          maxBoundsMaxX = Math.max( maxBoundsMaxX, chunk.maxX );
        }
      }

      /*************************************************************************
       * REDUCE AND APPLY
       *************************************************************************/

      let value: RasterChunkReducePair;

      const applyValue = async () => {
        const minClippedChunk = await clippedChunks.get( context, value.min.clippedChunkIndex );
        const maxClippedChunk = await clippedChunks.get( context, value.max.clippedChunkIndex );
        await clippedChunks.set( context, value.min.clippedChunkIndex, value.min.apply( minClippedChunk ) );
        await clippedChunks.set( context, value.max.clippedChunkIndex, value.max.apply( maxClippedChunk ) );
      };

      if ( exists ) {
        await edgeClips.set( context, minEdgeIndex, minClip );
        await edgeClips.set( context, maxEdgeIndex, maxClip );

        value = new RasterChunkReducePair(
          isXSplit ? new RasterChunkReduceData(
            minClippedChunkIndex,
            minArea,
            edge.isFirstEdge, edge.isLastEdge,
            minBoundsMinX, minBoundsMinY, minBoundsMaxX, minBoundsMaxY,
            0, 0, minCount, 0
          ) : new RasterChunkReduceData(
            minClippedChunkIndex,
            minArea,
            edge.isFirstEdge, edge.isLastEdge,
            minBoundsMinX, minBoundsMinY, minBoundsMaxX, minBoundsMaxY,
            0, 0, 0, minCount
          ),
          isXSplit ? new RasterChunkReduceData(
            maxClippedChunkIndex,
            maxArea,
            edge.isFirstEdge, edge.isLastEdge,
            maxBoundsMinX, maxBoundsMinY, maxBoundsMaxX, maxBoundsMaxY,
            maxCount, 0, 0, 0
          ) : new RasterChunkReduceData(
            maxClippedChunkIndex,
            maxArea,
            edge.isFirstEdge, edge.isLastEdge,
            maxBoundsMinX, maxBoundsMinY, maxBoundsMaxX, maxBoundsMaxY,
            0, maxCount, 0, 0
          )
        );

        // If our input is both first/last, we need to handle it before combinations
        if ( value.isFirstEdge() && value.isLastEdge() ) {
          await applyValue();
        }
      }
      else {
        value = RasterChunkReducePair.OUT_OF_RANGE;
      }

      await context.workgroupValues.reduces.set( context, context.localId.x, value );

      // We need to not double-apply. So we'll only apply when merging into this specific index, since it will
      // (a) be the first combination with the joint "both" result, and (b) it's the simplest to filter for.
      // Note: -5 is different than the "out of range" RasterChunkReduceData value
      const applicableMinChunkIndex = exists && value.isLastEdge() && !value.isFirstEdge() ? value.min.clippedChunkIndex : -5;

      await debugFullChunkReduces.set( context, context.globalId.x, value );

      for ( let i = 0; i < logWorkgroupSize; i++ ) {
        await context.workgroupBarrier();
        const delta = 1 << i;
        if ( context.localId.x >= delta ) {
          const otherValue = await context.workgroupValues.reduces.get( context, context.localId.x - delta );

          value = RasterChunkReducePair.combine( otherValue, value );

          // NOTE: The similar "max" condition would be identical. It would be
          // |     applicableMaxChunkIndex === otherMaxReduce.chunkIndex && maxReduce.isFirstEdge
          // We effectively only need to check and store one of these, since the min/max indices will be essentially
          // just offset by one
          if ( applicableMinChunkIndex === otherValue.min.clippedChunkIndex && value.isFirstEdge() ) {
            assert && assert( value.min.clippedChunkIndex === otherValue.min.clippedChunkIndex );
            assert && assert( value.max.clippedChunkIndex === otherValue.max.clippedChunkIndex );
            assert && assert( value.isLastEdge() );

            // NOTE: We don't need a workgroup barrier here with the two, since (a) we're not executing this for the
            // same indices ever, and (b) we only do it once.
            await applyValue();
          }
        }

        await context.workgroupBarrier();
        await context.workgroupValues.reduces.set( context, context.localId.x, value );
      }

      // Atomically compute the max(localId.x) that has the same chunkIndex as localId.x===0.
      const firstChunkIndex = await context.workgroupValues.firstChunkIndex.get( context, 0 );
      if ( exists && edge.chunkIndex === firstChunkIndex ) {
        context.workgroupValues.atomicMaxFirstChunkIndex = Math.max(
          context.workgroupValues.atomicMaxFirstChunkIndex,
          context.localId.x
        );
      }
      await context.workgroupBarrier(); // for the atomic

      // Store our reduction result
      if ( exists && context.localId.x === 0 ) {
        const lastLocalEdgeIndexInWorkgroup = Math.min(
          numEdges - 1 - context.workgroupId.x * workgroupSize,
          workgroupSize - 1
        );

        const leftValue = await context.workgroupValues.reduces.get( context, context.workgroupValues.atomicMaxFirstChunkIndex );
        const rightValue = await context.workgroupValues.reduces.get( context, lastLocalEdgeIndexInWorkgroup );

        await chunkReduces.set( context, context.workgroupId.x, new RasterChunkReduceQuad(
          leftValue.min,
          leftValue.max,
          rightValue.min,
          rightValue.max
        ) );
      }
    }, () => ( {
      reduces: new ParallelWorkgroupArray( _.range( 0, workgroupSize ).map( () => RasterChunkReducePair.INDETERMINATE ), RasterChunkReducePair.INDETERMINATE ),
      firstChunkIndex: new ParallelWorkgroupArray( [ 0 ], NaN ),
      atomicMaxFirstChunkIndex: 0
    } ), [ chunks, edges, clippedChunks, edgeClips, chunkReduces, debugFullChunkReduces ], workgroupSize );

    await ( new ParallelExecutor( kernel ).dispatch( Math.ceil( numEdges / workgroupSize ) ) );

    assert && ParallelRasterInitialClip.validate( workgroupSize, chunks, edges, numEdges, clippedChunks, edgeClips, chunkReduces, debugFullChunkReduces );
  }

  public static validate(
    workgroupSize: number,

    chunks: ParallelStorageArray<RasterChunk>,
    edges: ParallelStorageArray<RasterEdge>,
    numEdges: number,

    clippedChunks: ParallelStorageArray<RasterClippedChunk>,

    edgeClips: ParallelStorageArray<RasterEdgeClip>,
    chunkReduces: ParallelStorageArray<RasterChunkReduceQuad>,
    debugFullChunkReduces: ParallelStorageArray<{ min: RasterChunkReduceData; max: RasterChunkReduceData }>
  ): void {
    if ( assert ) {
      const numEdgeClips = numEdges * 2;
      assert( edgeClips.data.length >= numEdgeClips );

      for ( let edgeClipIndex = 0; edgeClipIndex < numEdgeClips; edgeClipIndex++ ) {
        const edgeClip = edgeClips.data[ edgeClipIndex ];
        assert( isFinite( edgeClip.clippedChunkIndex ) );

        const clippedChunk = clippedChunks.data[ edgeClip.clippedChunkIndex ];
        assert( clippedChunk && isFinite( clippedChunk.renderProgramIndex ) );

        const inputChunkIndex = edgeClip.clippedChunkIndex >> 1;
        const chunk = chunks.data[ inputChunkIndex ];
        assert( chunk && isFinite( chunk.renderProgramIndex ) );

        // Check the grouping of edgeClips
        const isMin = edgeClipIndex < 2 * chunk.edgesOffset + chunk.numEdges;
        const sectionOffset = isMin ? 2 * chunk.edgesOffset : 2 * chunk.edgesOffset + chunk.numEdges;
        const localIndex = edgeClipIndex - sectionOffset;

        assert( edgeClip.isFirstEdge === ( localIndex === 0 ) );
        assert( edgeClip.isLastEdge === ( localIndex === chunk.numEdges - 1 ) );

        const originalEdgeIndex = localIndex + chunk.edgesOffset;
        const edge = edges.data[ originalEdgeIndex ];

        assert( edge && isFinite( edge.chunkIndex ) );
        assert( edge.chunkIndex === inputChunkIndex );

        // NOTE: COULD check clipping
      }

      for ( let i = 0; i < Math.ceil( numEdges / workgroupSize ); i++ ) {
        const inputPairs = debugFullChunkReduces.data.slice( i * workgroupSize, ( i + 1 ) * workgroupSize );
        for ( let j = 0; j < workgroupSize; j++ ) {
          const inputBlock = inputPairs[ j ];
          const minReduce = inputBlock.min;
          const maxReduce = inputBlock.max;

          assert( isFinite( minReduce.clippedChunkIndex ) );
          assert( isFinite( maxReduce.clippedChunkIndex ) );

          assert(
            ( minReduce.clippedChunkIndex === maxReduce.clippedChunkIndex - 1 ) ||
            ( minReduce.clippedChunkIndex === -1 && maxReduce.clippedChunkIndex === -1 )
          );
        }

        const outputBlock = chunkReduces.data[ i ];

        let leftMinReduce = RasterChunkReduceData.OUT_OF_RANGE;
        let leftMaxReduce = RasterChunkReduceData.OUT_OF_RANGE;
        let rightMinReduce = RasterChunkReduceData.OUT_OF_RANGE;
        let rightMaxReduce = RasterChunkReduceData.OUT_OF_RANGE;

        for ( let j = 0; j < workgroupSize; j++ ) {
          const inputBlock = inputPairs[ j ];
          const minReduce = inputBlock.min;
          const maxReduce = inputBlock.max;

          if ( minReduce.clippedChunkIndex >= 0 ) {
            rightMinReduce = RasterChunkReduceData.combine( rightMinReduce, minReduce );
          }
          if ( maxReduce.clippedChunkIndex >= 0 ) {
            rightMaxReduce = RasterChunkReduceData.combine( rightMaxReduce, maxReduce );
          }

          if ( minReduce.clippedChunkIndex === inputPairs[ 0 ].min.clippedChunkIndex ) {
            leftMinReduce = j === 0 ? minReduce : RasterChunkReduceData.combine( leftMinReduce, minReduce );
          }
          if ( maxReduce.clippedChunkIndex === inputPairs[ 0 ].max.clippedChunkIndex ) {
            leftMaxReduce = j === 0 ? maxReduce : RasterChunkReduceData.combine( leftMaxReduce, maxReduce );
          }
        }

        assert( outputBlock.leftMin.equals( leftMinReduce ) );
        assert( outputBlock.leftMax.equals( leftMaxReduce ) );
        assert( outputBlock.rightMin.equals( rightMinReduce ) );
        assert( outputBlock.rightMax.equals( rightMaxReduce ) );
      }
    }
  }
}

alpenglow.register( 'ParallelRasterInitialClip', ParallelRasterInitialClip );