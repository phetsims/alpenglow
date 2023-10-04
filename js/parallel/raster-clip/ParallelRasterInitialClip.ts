// Copyright 2023, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, ParallelExecutor, ParallelKernel, ParallelStorageArray, ParallelWorkgroupArray, RasterChunk, RasterChunkReduceQuad, RasterChunkReduceData, RasterClippedChunk, RasterEdge, RasterEdgeClip } from '../../imports.js';
import Vector2 from '../../../../dot/js/Vector2.js';

export default class ParallelRasterInitialClip {
  public static async dispatch(
    workgroupSize: number,

    // read
    chunks: ParallelStorageArray<RasterChunk>,
    edges: ParallelStorageArray<RasterEdge>,
    numEdges: number,

    // read-write
    clippedChunks: ParallelStorageArray<RasterClippedChunk>,

    // write
    edgeClips: ParallelStorageArray<RasterEdgeClip>,
    chunkReduces: ParallelStorageArray<RasterChunkReduceQuad>,
    debugFullChunkReduces: ParallelStorageArray<{ min: RasterChunkReduceData; max: RasterChunkReduceData }>
  ): Promise<void> {
    const logWorkgroupSize = Math.log2( workgroupSize );

    type WorkgroupValues = {
      minReduces: ParallelWorkgroupArray<RasterChunkReduceData>;
      maxReduces: ParallelWorkgroupArray<RasterChunkReduceData>;
      firstChunkIndex: ParallelWorkgroupArray<number>; // NOT an array, just using that for atomics. one element, u32
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
      const minChunkIndex = 2 * edge.chunkIndex;
      const maxChunkIndex = 2 * edge.chunkIndex + 1;

      const xDiff = chunk.maxX - chunk.minX;
      const yDiff = chunk.maxY - chunk.minY;

      const isXSplit = xDiff > yDiff;

      // NOTE: This is set up so that if we have a half-pixel offset e.g. with a bilinear filter, it will work)
      const split = isXSplit ? chunk.minX + Math.floor( 0.5 * xDiff ) : chunk.minY + Math.floor( 0.5 * yDiff );

      // if isXSplit, then x is primary, y is secondary
      // if !isXSplit, then y is primary, x is secondary

      // TODO: potentially a better way where we don't require so many things for area calculation? Store the count?
      const minPoints = [
        new Vector2( 0, 0 ),
        new Vector2( 0, 0 ),
        new Vector2( 0, 0 ),
        new Vector2( 0, 0 )
      ];
      const maxPoints = [
        new Vector2( 0, 0 ),
        new Vector2( 0, 0 ),
        new Vector2( 0, 0 ),
        new Vector2( 0, 0 )
      ];
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
          minPoints[ 0 ].set( edge.startPoint );
          minPoints[ 1 ].set( edge.endPoint );
          minPoints[ 2 ].set( edge.endPoint );
          minPoints[ 3 ].set( edge.endPoint );
          maxSet = false;

          if ( startSecondaryLess !== endSecondaryLess ) {
            maxCount += startSecondaryLess ? 1 : -1;
          }
        }
        // both values greater than the split
        else if ( startPrimaryCmp === 1 ) {
          maxPoints[ 0 ].set( edge.startPoint );
          maxPoints[ 1 ].set( edge.endPoint );
          maxPoints[ 2 ].set( edge.endPoint );
          maxPoints[ 3 ].set( edge.endPoint );
          minSet = false;

          if ( startSecondaryLess !== endSecondaryLess ) {
            minCount += startSecondaryLess ? 1 : -1;
          }
        }
        // both values equal to the split
        else if ( startPrimaryCmp === 0 ) {
          // vertical/horizontal line ON our clip point. It is considered "inside" both, so we can just simply push it to both
          minPoints[ 0 ].set( edge.startPoint );
          minPoints[ 1 ].set( edge.endPoint );
          minPoints[ 2 ].set( edge.endPoint );
          minPoints[ 3 ].set( edge.endPoint );

          maxPoints[ 0 ].set( edge.startPoint );
          maxPoints[ 1 ].set( edge.endPoint );
          maxPoints[ 2 ].set( edge.endPoint );
          maxPoints[ 3 ].set( edge.endPoint );
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

        minPoints[ 0 ] = startGreater ? (
          isXSplit ? new Vector2( split, startCornerSecondary ) : new Vector2( startCornerSecondary, split )
        ) : minResultStartPoint;
        minPoints[ 1 ] = minResultStartPoint;
        minPoints[ 2 ] = minResultEndPoint;
        minPoints[ 3 ] = endGreater ? (
          isXSplit ? new Vector2( split, endCornerSecondary ) : new Vector2( endCornerSecondary, split )
        ) : minResultEndPoint;

        maxPoints[ 0 ] = startLess ? (
          isXSplit ? new Vector2( split, startCornerSecondary ) : new Vector2( startCornerSecondary, split )
        ) : maxResultStartPoint;
        maxPoints[ 1 ] = maxResultStartPoint;
        maxPoints[ 2 ] = maxResultEndPoint;
        maxPoints[ 3 ] = endLess ? (
          isXSplit ? new Vector2( split, endCornerSecondary ) : new Vector2( endCornerSecondary, split )
        ) : maxResultEndPoint;
      }

      const veryPositiveNumber = 1e10;
      const veryNegativeNumber = -1e10;

      const minClip = new RasterEdgeClip( minChunkIndex, minPoints[ 0 ], minPoints[ 1 ], minPoints[ 2 ], minPoints[ 3 ], edge.isFirstEdge, edge.isLastEdge );
      const maxClip = new RasterEdgeClip( maxChunkIndex, maxPoints[ 0 ], maxPoints[ 1 ], maxPoints[ 2 ], maxPoints[ 3 ], edge.isFirstEdge, edge.isLastEdge );

      const minArea = minClip.getArea();
      const maxArea = maxClip.getArea();

      let minBoundsMinX = minSet ? Math.min( minPoints[ 0 ].x, minPoints[ 1 ].x, minPoints[ 2 ].x, minPoints[ 3 ].x ) : veryPositiveNumber;
      let minBoundsMinY = minSet ? Math.min( minPoints[ 0 ].y, minPoints[ 1 ].y, minPoints[ 2 ].y, minPoints[ 3 ].y ) : veryPositiveNumber;
      let minBoundsMaxX = minSet ? Math.max( minPoints[ 0 ].x, minPoints[ 1 ].x, minPoints[ 2 ].x, minPoints[ 3 ].x ) : veryNegativeNumber;
      let minBoundsMaxY = minSet ? Math.max( minPoints[ 0 ].y, minPoints[ 1 ].y, minPoints[ 2 ].y, minPoints[ 3 ].y ) : veryNegativeNumber;

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

      let maxBoundsMinX = maxSet ? Math.min( maxPoints[ 0 ].x, maxPoints[ 1 ].x, maxPoints[ 2 ].x, maxPoints[ 3 ].x ) : veryPositiveNumber;
      let maxBoundsMinY = maxSet ? Math.min( maxPoints[ 0 ].y, maxPoints[ 1 ].y, maxPoints[ 2 ].y, maxPoints[ 3 ].y ) : veryPositiveNumber;
      let maxBoundsMaxX = maxSet ? Math.max( maxPoints[ 0 ].x, maxPoints[ 1 ].x, maxPoints[ 2 ].x, maxPoints[ 3 ].x ) : veryNegativeNumber;
      let maxBoundsMaxY = maxSet ? Math.max( maxPoints[ 0 ].y, maxPoints[ 1 ].y, maxPoints[ 2 ].y, maxPoints[ 3 ].y ) : veryNegativeNumber;

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

      let minReduce = isXSplit ? new RasterChunkReduceData(
        minChunkIndex,
        minArea,
        edge.isFirstEdge, edge.isLastEdge,
        minBoundsMinX, minBoundsMinY, minBoundsMaxX, minBoundsMaxY,
        0, 0, minCount, 0
      ) : new RasterChunkReduceData(
        minChunkIndex,
        minArea,
        edge.isFirstEdge, edge.isLastEdge,
        minBoundsMinX, minBoundsMinY, minBoundsMaxX, minBoundsMaxY,
        0, 0, 0, minCount
      );

      let maxReduce = isXSplit ? new RasterChunkReduceData(
        maxChunkIndex,
        maxArea,
        edge.isFirstEdge, edge.isLastEdge,
        maxBoundsMinX, maxBoundsMinY, maxBoundsMaxX, maxBoundsMaxY,
        maxCount, 0, 0, 0
      ) : new RasterChunkReduceData(
        maxChunkIndex,
        maxArea,
        edge.isFirstEdge, edge.isLastEdge,
        maxBoundsMinX, maxBoundsMinY, maxBoundsMaxX, maxBoundsMaxY,
        0, maxCount, 0, 0
      );

      if ( exists ) {
        await edgeClips.set( context, minEdgeIndex, minClip );
        await edgeClips.set( context, maxEdgeIndex, maxClip );
      }
      else {
        minReduce = RasterChunkReduceData.OUT_OF_RANGE;
        maxReduce = RasterChunkReduceData.OUT_OF_RANGE;
      }

      await context.workgroupValues.minReduces.set( context, context.localId.x, minReduce );
      await context.workgroupValues.maxReduces.set( context, context.localId.x, maxReduce );

      // If our input is both first/last, we need to handle it before combinations
      if ( minReduce.isFirstEdge && minReduce.isLastEdge ) {
        const minClippedChunk = await clippedChunks.get( context, minReduce.chunkIndex );
        await clippedChunks.set( context, minReduce.chunkIndex, minReduce.apply( minClippedChunk ) );
      }
      if ( maxReduce.isFirstEdge && maxReduce.isLastEdge ) {
        const maxClippedChunk = await clippedChunks.get( context, maxReduce.chunkIndex );
        await clippedChunks.set( context, maxReduce.chunkIndex, maxReduce.apply( maxClippedChunk ) );
      }

      // TODO: we really have duplicated chunk indices (they should be the same), factor these out
      // We need to not double-apply. So we'll only apply when merging into this specific index, since it will
      // (a) be the first combination with the joint "both" result, and (b) it's the simplest to filter for.
      // Note: -5 is different than the "out of range" RasterChunkReduceData value
      const appliableMinChunkIndex = exists && minReduce.isLastEdge && !minReduce.isFirstEdge ? minReduce.chunkIndex : -5;

      await debugFullChunkReduces.set( context, context.globalId.x, { min: minReduce, max: maxReduce } );

      // TODO: separate out code to work with RasterChunkReduceQuad?
      for ( let i = 0; i < logWorkgroupSize; i++ ) {
        await context.workgroupBarrier();
        const delta = 1 << i;
        if ( context.localId.x >= delta ) {
          // TODO: the two if statements are effectively evaluating the same thing (at least assert!)
          const otherMinReduce = await context.workgroupValues.minReduces.get( context, context.localId.x - delta );
          const otherMaxReduce = await context.workgroupValues.maxReduces.get( context, context.localId.x - delta );

          minReduce = RasterChunkReduceData.combine( otherMinReduce, minReduce );
          maxReduce = RasterChunkReduceData.combine( otherMaxReduce, maxReduce );

          // NOTE: The similar "max" condition would be identical. It would be
          // |     appliableMaxChunkIndex === otherMaxReduce.chunkIndex && maxReduce.isFirstEdge
          // We effectively only need to check and store one of these, since the min/max indices will be essentially
          // just offset by one
          if ( appliableMinChunkIndex === otherMinReduce.chunkIndex && minReduce.isFirstEdge ) {
            assert && assert( minReduce.chunkIndex === otherMinReduce.chunkIndex );
            assert && assert( maxReduce.chunkIndex === otherMaxReduce.chunkIndex );
            assert && assert( minReduce.isLastEdge );
            assert && assert( maxReduce.isLastEdge );

            // NOTE: We don't need a workgroup barrier here with the two, since (a) we're not executing this for the
            // same indices ever, and (b) we only do it once.

            const minClippedChunk = await clippedChunks.get( context, minReduce.chunkIndex );
            const maxClippedChunk = await clippedChunks.get( context, maxReduce.chunkIndex );

            await clippedChunks.set( context, minReduce.chunkIndex, minReduce.apply( minClippedChunk ) );
            await clippedChunks.set( context, maxReduce.chunkIndex, maxReduce.apply( maxClippedChunk ) );
          }
        }

        await context.workgroupBarrier();
        await context.workgroupValues.minReduces.set( context, context.localId.x, minReduce );
        await context.workgroupValues.maxReduces.set( context, context.localId.x, maxReduce );
      }

      const firstChunkIndex = await context.workgroupValues.firstChunkIndex.get( context, 0 );
      if ( exists && edge.chunkIndex === firstChunkIndex ) {
        context.workgroupValues.atomicMaxFirstChunkIndex = Math.max(
          context.workgroupValues.atomicMaxFirstChunkIndex,
          context.localId.x
        );
      }

      await context.workgroupBarrier(); // for the atomic

      if ( exists && context.localId.x === 0 ) {
        const lastLocalEdgeIndexInWorkgroup = Math.min(
          numEdges - 1 - context.workgroupId.x * workgroupSize,
          workgroupSize - 1
        );

        // console.log( context.workgroupId.x, firstChunkIndex, context.workgroupValues.atomicMaxFirstChunkIndex, lastLocalEdgeIndexInWorkgroup );
        await chunkReduces.set( context, context.workgroupId.x, new RasterChunkReduceQuad(
          await context.workgroupValues.minReduces.get( context, context.workgroupValues.atomicMaxFirstChunkIndex ),
          await context.workgroupValues.maxReduces.get( context, context.workgroupValues.atomicMaxFirstChunkIndex ),
          await context.workgroupValues.minReduces.get( context, lastLocalEdgeIndexInWorkgroup ),
          await context.workgroupValues.maxReduces.get( context, lastLocalEdgeIndexInWorkgroup )
        ) );
      }
    }, () => ( {
      minReduces: new ParallelWorkgroupArray( _.range( 0, workgroupSize ).map( () => RasterChunkReduceData.INDETERMINATE ), RasterChunkReduceData.INDETERMINATE ),
      maxReduces: new ParallelWorkgroupArray( _.range( 0, workgroupSize ).map( () => RasterChunkReduceData.INDETERMINATE ), RasterChunkReduceData.INDETERMINATE ),
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
        assert( isFinite( edgeClip.chunkIndex ) );

        // TODO: rename chunkIndex to clippedChunkIndex?
        const clippedChunk = clippedChunks.data[ edgeClip.chunkIndex ];
        assert( clippedChunk && isFinite( clippedChunk.rasterProgramIndex ) );

        const inputChunkIndex = edgeClip.chunkIndex >> 1;
        const chunk = chunks.data[ inputChunkIndex ];
        assert( chunk && isFinite( chunk.rasterProgramIndex ) );

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

        // TODO: COULD check clipping
      }

      for ( let i = 0; i < Math.ceil( numEdges / workgroupSize ); i++ ) {
        const inputPairs = debugFullChunkReduces.data.slice( i * workgroupSize, ( i + 1 ) * workgroupSize );
        for ( let j = 0; j < workgroupSize; j++ ) {
          const inputBlock = inputPairs[ j ];
          const minReduce = inputBlock.min;
          const maxReduce = inputBlock.max;

          assert( isFinite( minReduce.chunkIndex ) );
          assert( isFinite( maxReduce.chunkIndex ) );

          assert(
            ( minReduce.chunkIndex === maxReduce.chunkIndex - 1 ) ||
            ( minReduce.chunkIndex === -1 && maxReduce.chunkIndex === -1 )
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

          if ( minReduce.chunkIndex >= 0 ) {
            rightMinReduce = RasterChunkReduceData.combine( rightMinReduce, minReduce );
          }
          if ( maxReduce.chunkIndex >= 0 ) {
            rightMaxReduce = RasterChunkReduceData.combine( rightMaxReduce, maxReduce );
          }

          if ( minReduce.chunkIndex === inputPairs[ 0 ].min.chunkIndex ) {
            leftMinReduce = j === 0 ? minReduce : RasterChunkReduceData.combine( leftMinReduce, minReduce );
          }
          if ( maxReduce.chunkIndex === inputPairs[ 0 ].max.chunkIndex ) {
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
