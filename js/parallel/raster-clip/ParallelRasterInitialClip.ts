// Copyright 2023, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, ParallelExecutor, ParallelKernel, ParallelStorageArray, ParallelWorkgroupArray, RasterChunk, RasterChunkReduceData, RasterClippedChunk, RasterEdge, RasterEdgeClip } from '../../imports.js';
import Vector2 from '../../../../dot/js/Vector2.js';

export default class ParallelRasterInitialClip {
  public static async dispatch(
    workgroupSize: number,

    // input
    chunks: ParallelStorageArray<RasterChunk>,
    edges: ParallelStorageArray<RasterEdge>,
    clippedChunks: ParallelStorageArray<RasterClippedChunk>,
    numEdges: number,

    // output
    edgeClips: ParallelStorageArray<RasterEdgeClip>,
    chunkReduces: ParallelStorageArray<RasterChunkReduceData>,
    debugFullChunkReduces: ParallelStorageArray<RasterChunkReduceData>
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

      const workgroupFirstEdgeIndex = context.workgroupId.x * workgroupSize;
      const workgroupLastEdgeIndex = Math.min( workgroupFirstEdgeIndex + workgroupSize - 1, numEdges - 1 );

      const edgeIndex = context.globalId.x;
      const exists = edgeIndex < numEdges;

      const edge = await edges.get( context, edgeIndex );
      const chunk = await chunks.get( context, edge.chunkIndex );

      // We'll workgroupBarrier at least once below, before this is relevant
      if ( exists && edgeIndex === workgroupFirstEdgeIndex ) {
        await context.workgroupValues.firstChunkIndex.set( context, 0, edge.chunkIndex );
      }

      const minEdgeIndex = edgeIndex;
      const maxEdgeIndex = numEdges + edgeIndex;
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

      const centerSecondary = 0.5 * ( isXSplit ? chunk.minY + chunk.maxY : chunk.minX + chunk.maxX );
      const startPoint = edge.startPoint;
      const endPoint = edge.endPoint;

      // TODO: with fastmath, will these be equivalent?
      const startPrimaryCmp = Math.sign( ( isXSplit ? startPoint.x : startPoint.y ) - split );
      const endPrimaryCmp = Math.sign( ( isXSplit ? endPoint.x : endPoint.y ) - split );
      const startSecondaryLess = ( isXSplit ? startPoint.y : startPoint.x ) < centerSecondary;
      const endSecondaryLess = ( isXSplit ? endPoint.y : endPoint.x ) < centerSecondary;

      // TODO: simplify out the startPrimaryCmp === endPrimaryCmp, since we have fewer cases, half the stuff
      // both values less than the split
      if ( startPrimaryCmp === -1 && endPrimaryCmp === -1 ) {
        minPoints[ 0 ].set( edge.startPoint );
        minPoints[ 1 ].set( edge.endPoint );
        minPoints[ 2 ].set( edge.endPoint );
        minPoints[ 3 ].set( edge.endPoint );

        if ( startSecondaryLess !== endSecondaryLess ) {
          maxCount += startSecondaryLess ? 1 : -1;
        }
      }
      // both values greater than the split
      else if ( startPrimaryCmp === 1 && endPrimaryCmp === 1 ) {
        maxPoints[ 0 ].set( edge.startPoint );
        maxPoints[ 1 ].set( edge.endPoint );
        maxPoints[ 2 ].set( edge.endPoint );
        maxPoints[ 3 ].set( edge.endPoint );

        if ( startSecondaryLess !== endSecondaryLess ) {
          minCount += startSecondaryLess ? 1 : -1;
        }
      }
      // both values equal to the split
      else if ( startPrimaryCmp === 0 && endPrimaryCmp === 0 ) {
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

      const minClip = new RasterEdgeClip( minPoints[ 0 ], minPoints[ 1 ], minPoints[ 2 ], minPoints[ 3 ], edge.isFirstEdge, edge.isLastEdge );
      const maxClip = new RasterEdgeClip( maxPoints[ 0 ], maxPoints[ 1 ], maxPoints[ 2 ], maxPoints[ 3 ], edge.isFirstEdge, edge.isLastEdge );

      const minArea = minClip.getArea();
      const maxArea = maxClip.getArea();

      let minReduce = isXSplit ? new RasterChunkReduceData(
        minChunkIndex,
        minArea,
        edge.isFirstEdge, edge.isLastEdge,
        chunk.minX, chunk.minY, split, chunk.maxY,
        0, 0, minCount, 0
      ) : new RasterChunkReduceData(
        minChunkIndex,
        minArea,
        edge.isFirstEdge, edge.isLastEdge,
        chunk.minX, chunk.minY, chunk.maxX, split,
        0, 0, 0, minCount
      );

      let maxReduce = isXSplit ? new RasterChunkReduceData(
        maxChunkIndex,
        maxArea,
        edge.isFirstEdge, edge.isLastEdge,
        split, chunk.minY, chunk.maxX, chunk.maxY,
        maxCount, 0, 0, 0
      ) : new RasterChunkReduceData(
        maxChunkIndex,
        maxArea,
        edge.isFirstEdge, edge.isLastEdge,
        chunk.minX, split, chunk.maxX, chunk.maxY,
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

      await debugFullChunkReduces.set( context, 2 * context.globalId.x, minReduce );
      await debugFullChunkReduces.set( context, 2 * context.globalId.x + 1, maxReduce );

      for ( let i = 0; i < logWorkgroupSize; i++ ) {
        await context.workgroupBarrier();
        const delta = 1 << i;
        if ( context.localId.x >= delta ) {
          // TODO: the two if statements are effectively evaluating the same thing (at least assert!)
          const otherMinReduce = await context.workgroupValues.minReduces.get( context, context.localId.x - delta );
          minReduce = RasterChunkReduceData.combine( otherMinReduce, minReduce );
          if ( minReduce.chunkIndex === otherMinReduce.chunkIndex && minReduce.isFirstEdge && minReduce.isLastEdge ) {
            const minClippedChunk = await clippedChunks.get( context, minReduce.chunkIndex );
            await clippedChunks.set( context, minReduce.chunkIndex, minReduce.apply( minClippedChunk ) );
          }

          const otherMaxReduce = await context.workgroupValues.maxReduces.get( context, context.localId.x - delta );
          maxReduce = RasterChunkReduceData.combine( otherMaxReduce, maxReduce );
          if ( maxReduce.chunkIndex === otherMaxReduce.chunkIndex && maxReduce.isFirstEdge && maxReduce.isLastEdge ) {
            const maxClippedChunk = await clippedChunks.get( context, maxReduce.chunkIndex );
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

      if ( exists && context.localId.x === context.workgroupValues.atomicMaxFirstChunkIndex ) {
        await chunkReduces.set( context, 4 * context.workgroupId.x, minReduce );
        await chunkReduces.set( context, 4 * context.workgroupId.x + 1, maxReduce );
      }
      if ( exists && context.localId.x === workgroupLastEdgeIndex ) {
        await chunkReduces.set( context, 4 * context.workgroupId.x + 2, minReduce );
        await chunkReduces.set( context, 4 * context.workgroupId.x + 3, maxReduce );
      }
    }, () => ( {
      minReduces: new ParallelWorkgroupArray( _.range( 0, workgroupSize ).map( () => RasterChunkReduceData.INDETERMINATE ), RasterChunkReduceData.INDETERMINATE ),
      maxReduces: new ParallelWorkgroupArray( _.range( 0, workgroupSize ).map( () => RasterChunkReduceData.INDETERMINATE ), RasterChunkReduceData.INDETERMINATE ),
      firstChunkIndex: new ParallelWorkgroupArray( [ 0 ], NaN ),
      atomicMaxFirstChunkIndex: 0
    } ), [ chunks, edges, clippedChunks, edgeClips, chunkReduces, debugFullChunkReduces ], workgroupSize );

    await ( new ParallelExecutor( kernel ).dispatch( Math.ceil( numEdges / workgroupSize ) ) );
  }
}

alpenglow.register( 'ParallelRasterInitialClip', ParallelRasterInitialClip );
