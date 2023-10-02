// Copyright 2023, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, ParallelExecutor, ParallelKernel, ParallelStorageArray, ParallelWorkgroupArray, RasterChunk, RasterClippedChunk, RasterCompleteChunk, RasterSplitReduceData } from '../../imports.js';

export default class ParallelRasterChunkIndexPatch {
  public static async dispatch(
    workgroupSize: number,

    // input
    // TODO: look into ways to reduce the number of inputs, we're hitting a lot of memory
    chunkIndexMap: ParallelStorageArray<number>,
    chunkIndices: ParallelStorageArray<number>,
    reducibleChunks: ParallelStorageArray<RasterChunk>, // mutated
    completeChunks: ParallelStorageArray<RasterCompleteChunk>, // mutated
    clippedChunks: ParallelStorageArray<RasterClippedChunk>, // mutated
    numClippedChunks: number
  ): Promise<void> {
    const kernel = new ParallelKernel( async context => {
      await context.start();

      const chunkIndex = context.globalId.x;
      const exists = chunkIndex < numClippedChunks;

      if ( exists ) {
        // TODO: clippedChunkIndex name
        const clippedChunk = await clippedChunks.get( context, chunkIndex );
        const isReducible = clippedChunk.isReducible;
        const isComplete = clippedChunk.isComplete;

        const outputChunkIndex = await chunkIndexMap.get( context, chunkIndex );

        const startIndex = await chunkIndices.get( context, 2 * chunkIndex );
        const endIndex = await chunkIndices.get( context, 2 * chunkIndex + 1 );

        if ( isReducible ) {
          const chunk = await reducibleChunks.get( context, outputChunkIndex );
          await reducibleChunks.set( context, outputChunkIndex, chunk.withEdgeInfo( startIndex, endIndex ) );
        }

        if ( isComplete ) {
          const chunk = await completeChunks.get( context, outputChunkIndex );
          await completeChunks.set( context, outputChunkIndex, chunk.withEdgeInfo( startIndex, endIndex ) );
        }
      }
    }, () => ( {
      reduces: new ParallelWorkgroupArray( _.range( 0, workgroupSize ).map( () => RasterSplitReduceData.INDETERMINATE ), RasterSplitReduceData.INDETERMINATE ),
      baseIndices: new ParallelWorkgroupArray( [ 0, 0 ], 0 )
    } ), [ chunkIndexMap, chunkIndices, reducibleChunks, completeChunks, clippedChunks ], workgroupSize );

    await ( new ParallelExecutor( kernel ).dispatch( Math.ceil( numClippedChunks / workgroupSize ) ) );
  }
}

alpenglow.register( 'ParallelRasterChunkIndexPatch', ParallelRasterChunkIndexPatch );
