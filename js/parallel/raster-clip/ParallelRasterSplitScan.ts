// Copyright 2023, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, ParallelExecutor, ParallelKernel, ParallelStorageArray, ParallelWorkgroupArray, RasterChunk, RasterClippedChunk, RasterSplitReduceData } from '../../imports.js';

export default class ParallelRasterSplitScan {
  public static async dispatch(
    workgroupSize: number,

    // input
    clippedChunks: ParallelStorageArray<RasterClippedChunk>,
    splitReduces0: ParallelStorageArray<RasterSplitReduceData>,
    splitReduces1: ParallelStorageArray<RasterSplitReduceData>,
    splitReduces2: ParallelStorageArray<RasterSplitReduceData>,
    numClippedChunks: number,

    // output
    reducibleChunks: ParallelStorageArray<RasterChunk>,
    completeChunks: ParallelStorageArray<RasterChunk>,
    chunkIndexMap: ParallelStorageArray<number>
  ): Promise<void> {
    const logWorkgroupSize = Math.log2( workgroupSize );

    type WorkgroupValues = {
      reduces: ParallelWorkgroupArray<RasterSplitReduceData>;
      baseIndices: ParallelWorkgroupArray<number>; // [ reducible, complete ], implement with two workgroup values
    };

    const kernel = new ParallelKernel<WorkgroupValues>( async context => {
      await context.start();

      // TODO: code share with edge scan?
      const chunkIndex = context.globalId.x;
      const exists = chunkIndex < numClippedChunks;

      // TODO: better way to scan? Does this lead to inefficient memory?
      if ( context.localId.x === 0 ) {
        const index0 = Math.floor( chunkIndex / workgroupSize );
        const index1 = Math.floor( index0 / workgroupSize );
        const index2 = Math.floor( index1 / workgroupSize );

        // Convert to an exclusive scan with the different indices
        const reduce0 = index0 > 0 ? ( await splitReduces0.get( context, index0 - 1 ) ) : RasterSplitReduceData.IDENTITY;
        const reduce1 = index1 > 0 ? ( await splitReduces1.get( context, index1 - 1 ) ) : RasterSplitReduceData.IDENTITY;
        const reduce2 = index2 > 0 ? ( await splitReduces2.get( context, index2 - 1 ) ) : RasterSplitReduceData.IDENTITY;

        const baseReducible = reduce2.numReducible + reduce1.numReducible + reduce0.numReducible;
        const baseComplete = reduce2.numComplete + reduce1.numComplete + reduce0.numComplete;

        await context.workgroupValues.baseIndices.set( context, 0, baseReducible );
        await context.workgroupValues.baseIndices.set( context, 1, baseComplete );

        // We'll have a barrier before we read this due to the scan, so we don't need to worry much about this
      }

      const clippedChunk = await clippedChunks.get( context, chunkIndex );

      const initialValue = new RasterSplitReduceData(
        exists && clippedChunk.isReducible ? 1 : 0,
        exists && clippedChunk.isComplete ? 1 : 0
      );
      let value = initialValue;

      await context.workgroupValues.reduces.set( context, context.localId.x, value );

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

      if ( exists ) {
        const baseReducible = await context.workgroupValues.baseIndices.get( context, 0 );
        const baseComplete = await context.workgroupValues.baseIndices.get( context, 1 );

        let baseIndex = 0; // filled in later

        if ( clippedChunk.isReducible ) {
          // Convert to exclusive prefix sum TODO better way
          baseIndex = baseReducible + value.numReducible - initialValue.numReducible;

          await chunkIndexMap.set( context, chunkIndex, baseIndex );

          await reducibleChunks.set( context, baseIndex, new RasterChunk(
            clippedChunk.rasterProgramIndex,
            clippedChunk.needsCentroid,
            clippedChunk.needsFace,
            -1, // filled in later
            -1, // filled in later
            clippedChunk.minX, clippedChunk.minY, clippedChunk.maxX, clippedChunk.maxY,
            clippedChunk.minXCount, clippedChunk.minYCount, clippedChunk.maxXCount, clippedChunk.maxYCount
          ) );
        }

        if ( clippedChunk.isComplete ) {
          // Convert to exclusive prefix sum TODO better way
          baseIndex = baseComplete + value.numComplete - initialValue.numComplete;

          await chunkIndexMap.set( context, chunkIndex, baseIndex );

          await completeChunks.set( context, baseIndex, new RasterChunk(
            clippedChunk.rasterProgramIndex,
            clippedChunk.needsCentroid,
            clippedChunk.needsFace,
            -1, // filled in later
            -1, // filled in later
            clippedChunk.minX, clippedChunk.minY, clippedChunk.maxX, clippedChunk.maxY,
            clippedChunk.minXCount, clippedChunk.minYCount, clippedChunk.maxXCount, clippedChunk.maxYCount
          ) );
        }
      }
    }, () => ( {
      reduces: new ParallelWorkgroupArray( _.range( 0, workgroupSize ).map( () => RasterSplitReduceData.INDETERMINATE ), RasterSplitReduceData.INDETERMINATE ),
      baseIndices: new ParallelWorkgroupArray( [ 0, 0 ], 0 )
    } ), [ clippedChunks, splitReduces0, splitReduces1, splitReduces2, reducibleChunks, completeChunks ], workgroupSize );

    await ( new ParallelExecutor( kernel ).dispatch( Math.ceil( numClippedChunks / workgroupSize ) ) );
  }
}

alpenglow.register( 'ParallelRasterSplitScan', ParallelRasterSplitScan );
