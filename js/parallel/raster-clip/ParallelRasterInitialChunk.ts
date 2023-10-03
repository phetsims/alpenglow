// Copyright 2023, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, ParallelExecutor, ParallelKernel, ParallelStorageArray, RasterChunk, RasterClippedChunk } from '../../imports.js';

export default class ParallelRasterInitialChunk {
  public static async dispatch(
    workgroupSize: number,

    // read
    chunks: ParallelStorageArray<RasterChunk>,
    numChunks: number,

    // write
    clippedChunks: ParallelStorageArray<RasterClippedChunk>
  ): Promise<void> {
    const kernel = new ParallelKernel( async context => {
      await context.start();

      const chunkIndex = context.globalId.x;
      if ( chunkIndex < numChunks ) {

        const chunk = await chunks.get( context, chunkIndex );

        const minChunkIndex = 2 * chunkIndex;
        const maxChunkIndex = 2 * chunkIndex + 1;

        const xDiff = chunk.maxX - chunk.minX;
        const yDiff = chunk.maxY - chunk.minY;

        const hasEdges = chunk.numEdges > 0;
        let minChunk: RasterClippedChunk;
        let maxChunk: RasterClippedChunk;

        if ( hasEdges ) {
          const isXSplit = xDiff > yDiff;

          // NOTE: This is set up so that if we have a half-pixel offset e.g. with a bilinear filter, it will work)
          const split = isXSplit ? chunk.minX + Math.floor( 0.5 * xDiff ) : chunk.minY + Math.floor( 0.5 * yDiff );

          minChunk = new RasterClippedChunk(
            chunk.rasterProgramIndex,
            chunk.needsFace,

            // Filled in and modified later (past this point)
            false,
            false,
            false,
            -1,

            chunk.minX,
            chunk.minY,
            isXSplit ? split : chunk.maxX,
            isXSplit ? chunk.maxY : split,

            chunk.minXCount,
            chunk.minYCount,
            chunk.maxXCount,
            chunk.maxYCount
          );

          maxChunk = new RasterClippedChunk(
            chunk.rasterProgramIndex,
            chunk.needsFace,

            // Filled in and modified later (past this point)
            false,
            false,
            false,
            -1,

            isXSplit ? split : chunk.minX,
            isXSplit ? chunk.minY : split,
            chunk.maxX,
            chunk.maxY,

            chunk.minXCount,
            chunk.minYCount,
            chunk.maxXCount,
            chunk.maxYCount
          );
        }
        else {
          const hasArea = chunk.minXCount < 0 && chunk.minYCount > 0 && chunk.maxXCount > 0 && chunk.maxYCount;
          if ( hasArea ) {
            minChunk = new RasterClippedChunk(
              chunk.rasterProgramIndex,
              chunk.needsFace,

              false,
              true,
              true,
              xDiff * yDiff,

              chunk.minX, chunk.minY, chunk.maxX, chunk.maxY,
              -1, 1, 1, -1
            );
          }
          else {
            minChunk = RasterClippedChunk.DISCARDABLE;
          }

          maxChunk = RasterClippedChunk.DISCARDABLE;
        }

        await clippedChunks.set( context, minChunkIndex, minChunk );
        await clippedChunks.set( context, maxChunkIndex, maxChunk );
      }
    }, () => ( {} ), [ chunks, clippedChunks ], workgroupSize );

    await ( new ParallelExecutor( kernel ).dispatch( Math.ceil( numChunks / workgroupSize ) ) );

    assert && ParallelRasterInitialChunk.validate( workgroupSize, chunks, numChunks, clippedChunks );
  }

  public static validate(
    workgroupSize: number,
    chunks: ParallelStorageArray<RasterChunk>,
    numChunks: number,
    clippedChunks: ParallelStorageArray<RasterClippedChunk>
  ): void {
    if ( assert ) {
      const numClippedChunks = 2 * numChunks;
      assert( chunks.data.length >= numChunks );
      assert( clippedChunks.data.length >= numClippedChunks );

      for ( let chunkIndex = 0; chunkIndex < numChunks; chunkIndex++ ) {
        const chunk = chunks.data[ chunkIndex ];
        const minClippedChunk = clippedChunks.data[ 2 * chunkIndex ];
        const maxClippedChunk = clippedChunks.data[ 2 * chunkIndex + 1 ];

        if ( chunk.numEdges > 0 ) {
          assert( minClippedChunk.rasterProgramIndex === chunk.rasterProgramIndex );
          assert( maxClippedChunk.rasterProgramIndex === chunk.rasterProgramIndex );

          assert( minClippedChunk.needsFace === chunk.needsFace );
          assert( maxClippedChunk.needsFace === chunk.needsFace );

          assert( minClippedChunk.minXCount === chunk.minXCount );
          assert( minClippedChunk.minYCount === chunk.minYCount );
          assert( maxClippedChunk.maxXCount === chunk.maxXCount );
          assert( maxClippedChunk.maxYCount === chunk.maxYCount );
        }
      }
    }
  }
}

alpenglow.register( 'ParallelRasterInitialChunk', ParallelRasterInitialChunk );
