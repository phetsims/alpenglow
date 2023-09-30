// Copyright 2023, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, ParallelExecutor, ParallelKernel, ParallelStorageArray, RasterChunk, RasterClippedChunk } from '../../imports.js';

export default class ParallelRasterInitialChunk {
  public static async dispatch(
    // input
    chunks: ParallelStorageArray<RasterChunk>,
    numChunks: number,

    // output
    clippedChunks: ParallelStorageArray<RasterClippedChunk>
  ): Promise<void> {
    const workgroupSize = 256;

    const kernel = new ParallelKernel( async context => {
      await context.start();

      const chunkIndex = context.globalId.x;
      if ( chunkIndex < numChunks ) {

        const chunk = await chunks.get( context, chunkIndex );

        const minChunkIndex = 2 * chunkIndex;
        const maxChunkIndex = 2 * chunkIndex + 1;

        const xDiff = chunk.maxX - chunk.minX;
        const yDiff = chunk.maxY - chunk.minY;

        const isXSplit = xDiff > yDiff;

        // NOTE: This is set up so that if we have a half-pixel offset e.g. with a bilinear filter, it will work)
        const split = isXSplit ? chunk.minX + Math.floor( 0.5 * xDiff ) : chunk.minY + Math.floor( 0.5 * yDiff );

        const minChunk = new RasterClippedChunk(
          chunk.rasterProgramIndex,
          chunk.needsCentroid,
          chunk.needsFace,

          // TODO: how do we fill in this data?
          0,
          0,
          0,

          chunk.minX,
          chunk.minY,
          isXSplit ? split : chunk.maxX,
          isXSplit ? chunk.maxY : split,

          chunk.minXCount,
          chunk.minYCount,
          chunk.maxXCount,
          chunk.maxYCount
        );

        const maxChunk = new RasterClippedChunk(
          chunk.rasterProgramIndex,
          chunk.needsCentroid,
          chunk.needsFace,

          // TODO: how do we fill in this data?
          0,
          0,
          0,

          isXSplit ? split : chunk.minX,
          isXSplit ? chunk.minY : split,
          chunk.maxX,
          chunk.maxY,

          chunk.minXCount,
          chunk.minYCount,
          chunk.maxXCount,
          chunk.maxYCount
        );

        await clippedChunks.set( context, minChunkIndex, minChunk );
        await clippedChunks.set( context, maxChunkIndex, maxChunk );
      }
    }, () => ( {} ), [ chunks, clippedChunks ], workgroupSize );

    await ( new ParallelExecutor( kernel ).dispatch( Math.ceil( numChunks / workgroupSize ) ) );
  }
}

alpenglow.register( 'ParallelRasterInitialChunk', ParallelRasterInitialChunk );
