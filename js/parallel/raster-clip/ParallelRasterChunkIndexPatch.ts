// Copyright 2023-2025, University of Colorado Boulder

/**
 * Updates the reducible/complete chunks with proper destination edge indices (so the chunk references the range of
 * edges it is comprised of).
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow } from '../../alpenglow.js';
import { ParallelKernel } from '../ParallelKernel.js';
import { ParallelWorkgroupArray } from '../ParallelWorkgroupArray.js';
import { ParallelExecutor } from '../ParallelExecutor.js';
import { RasterSplitReduceData } from './RasterSplitReduceData.js';
import type { ParallelStorageArray } from '../ParallelStorageArray.js';
import type { RasterClippedChunk } from './RasterClippedChunk.js';
import type { RasterChunk } from './RasterChunk.js';
import type { RasterCompleteChunk } from './RasterCompleteChunk.js';

export class ParallelRasterChunkIndexPatch {
  public static async dispatch(
    workgroupSize: number,

    // read
    chunkIndexMap: ParallelStorageArray<number>,
    chunkIndices: ParallelStorageArray<number>,
    clippedChunks: ParallelStorageArray<RasterClippedChunk>,
    numClippedChunks: number,

    // read-write
    reducibleChunks: ParallelStorageArray<RasterChunk>,
    completeChunks: ParallelStorageArray<RasterCompleteChunk>
  ): Promise<void> {
    const kernel = new ParallelKernel( async context => {
      await context.start();

      const clippedChunkIndex = context.globalId.x;
      const exists = clippedChunkIndex < numClippedChunks;

      if ( exists ) {
        const clippedChunk = await clippedChunks.get( context, clippedChunkIndex );
        const outputChunkIndex = await chunkIndexMap.get( context, clippedChunkIndex );

        const startIndex = await chunkIndices.get( context, 2 * clippedChunkIndex );
        const endIndex = await chunkIndices.get( context, 2 * clippedChunkIndex + 1 );

        if ( clippedChunk.isReducible ) {
          const chunk = await reducibleChunks.get( context, outputChunkIndex );
          await reducibleChunks.set( context, outputChunkIndex, chunk.withEdgeInfo( startIndex, endIndex ) );
        }

        if ( clippedChunk.isComplete ) {
          const chunk = await completeChunks.get( context, outputChunkIndex );
          await completeChunks.set( context, outputChunkIndex, chunk.withEdgeInfo(
            clippedChunk.needsFace ? startIndex : 0,
            clippedChunk.needsFace ? endIndex : 0
          ) );
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