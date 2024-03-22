// Copyright 2023, University of Colorado Boulder

/**
 * Calculates the initial splits (reducible/complete counts) for each clipped chunk, and applies the first level of
 * reduction.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, ParallelExecutor, ParallelKernel, ParallelStorageArray, ParallelWorkgroupArray, RasterClippedChunk, RasterSplitReduceData } from '../../imports.js';

export default class ParallelRasterInitialSplitReduce {
  public static async dispatch(
    workgroupSize: number,

    // read
    clippedChunks: ParallelStorageArray<RasterClippedChunk>,
    numClippedChunks: number,

    // write
    debugFullSplitReduces: ParallelStorageArray<RasterSplitReduceData>,
    splitReduces: ParallelStorageArray<RasterSplitReduceData>
  ): Promise<void> {
    const logWorkgroupSize = Math.log2( workgroupSize );

    type WorkgroupValues = {
      reduces: ParallelWorkgroupArray<RasterSplitReduceData>;
    };

    const kernel = new ParallelKernel<WorkgroupValues>( async context => {
      await context.start();

      const chunkIndex = context.globalId.x;
      const exists = chunkIndex < numClippedChunks;

      const clippedChunk = await clippedChunks.get( context, chunkIndex );

      let value = exists ? clippedChunk.getSplitReduceData() : RasterSplitReduceData.IDENTITY;

      await context.workgroupValues.reduces.set( context, context.localId.x, value );

      await debugFullSplitReduces.set( context, context.globalId.x, value );

      for ( let i = 0; i < logWorkgroupSize; i++ ) {
        await context.workgroupBarrier();
        const delta = 1 << i;
        if ( context.localId.x >= delta ) {
          const other = await context.workgroupValues.reduces.get( context, context.localId.x - delta );
          value = RasterSplitReduceData.combine( other, value );
        }

        await context.workgroupBarrier();
        await context.workgroupValues.reduces.set( context, context.localId.x, value );
      }

      if ( context.localId.x === workgroupSize - 1 ) {
        await splitReduces.set( context, context.workgroupId.x, value );
      }
    }, () => ( {
      reduces: new ParallelWorkgroupArray( _.range( 0, workgroupSize ).map( () => RasterSplitReduceData.INDETERMINATE ), RasterSplitReduceData.INDETERMINATE )
    } ), [ clippedChunks, debugFullSplitReduces, splitReduces ], workgroupSize );

    await ( new ParallelExecutor( kernel ).dispatch( Math.ceil( numClippedChunks / workgroupSize ) ) );
  }
}

alpenglow.register( 'ParallelRasterInitialSplitReduce', ParallelRasterInitialSplitReduce );