// Copyright 2023, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, ParallelExecutor, ParallelKernel, ParallelStorageArray, RasterChunk, RasterChunkReduceData, RasterClippedChunk, RasterEdge, RasterEdgeClip } from '../../imports.js';
import Vector2 from '../../../../dot/js/Vector2.js';

export default class ParallelRasterInitialClip {
  public static async dispatch(
    // input
    chunks: ParallelStorageArray<RasterChunk>,
    edges: ParallelStorageArray<RasterEdge>,
    clippedChunks: ParallelStorageArray<RasterClippedChunk>,
    numEdges: number,

    // output
    edgeClips: ParallelStorageArray<RasterEdgeClip>,
    chunkReduces: ParallelStorageArray<RasterChunkReduceData>
  ): Promise<void> {
    const workgroupSize = 256;

    const kernel = new ParallelKernel( async context => {
      await context.start();

      const edgeIndex = context.globalId.x;
      if ( edgeIndex < numEdges ) {

        const edge = await edges.get( context, edgeIndex );
        const chunk = await chunks.get( context, edge.chunkIndex );

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

        const minClip = new RasterEdgeClip( minPoints[ 0 ], minPoints[ 1 ], minPoints[ 2 ], minPoints[ 3 ], edge.isFirstEdge );
        const maxClip = new RasterEdgeClip( maxPoints[ 0 ], maxPoints[ 1 ], maxPoints[ 2 ], maxPoints[ 3 ], edge.isFirstEdge );

        const minArea = minClip.getArea();
        const maxArea = maxClip.getArea();

        // TODO: ensure that the base counts are included in the reduce!
        const minReduce = isXSplit ? new RasterChunkReduceData(
          minChunkIndex,
          minArea,
          chunk.minX, chunk.minY, split, chunk.maxY,
          0, 0, minCount, 0
        ) : new RasterChunkReduceData(
          minChunkIndex,
          minArea,
          chunk.minX, chunk.minY, chunk.maxX, split,
          0, 0, 0, minCount
        );

        const maxReduce = isXSplit ? new RasterChunkReduceData(
          maxChunkIndex,
          maxArea,
          split, chunk.minY, chunk.maxX, chunk.maxY,
          maxCount, 0, 0, 0
        ) : new RasterChunkReduceData(
          maxChunkIndex,
          maxArea,
          chunk.minX, split, chunk.maxX, chunk.maxY,
          0, maxCount, 0, 0
        );

        await edgeClips.set( context, minEdgeIndex, minClip );
        await edgeClips.set( context, maxEdgeIndex, maxClip );
        await chunkReduces.set( context, minEdgeIndex, minReduce );
        await chunkReduces.set( context, maxEdgeIndex, maxReduce );
      }
    }, () => ( {} ), [ chunks, edges, clippedChunks, edgeClips, chunkReduces ], workgroupSize );

    await ( new ParallelExecutor( kernel ).dispatch( Math.ceil( numEdges / workgroupSize ) ) );
  }
}

alpenglow.register( 'ParallelRasterInitialClip', ParallelRasterInitialClip );
