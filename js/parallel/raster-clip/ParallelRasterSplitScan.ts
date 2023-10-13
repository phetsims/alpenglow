// Copyright 2023, University of Colorado Boulder

/**
 * Multiple stream compaction for chunks: distributes the relevant data from the clipped chunks to the reducible and
 * complete chunks, and generates the chunkIndexMap.
 *
 * NOTE: Has similar code to ParallelRasterEdgeScan
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, ParallelExecutor, ParallelKernel, ParallelStorageArray, ParallelUtils, ParallelWorkgroupArray, RasterChunk, RasterClippedChunk, RasterCompleteChunk, RasterSplitReduceData } from '../../imports.js';

export default class ParallelRasterSplitScan {
  public static async dispatch(
    workgroupSize: number,

    // read
    clippedChunks: ParallelStorageArray<RasterClippedChunk>,
    splitReduces0: ParallelStorageArray<RasterSplitReduceData>,
    splitReduces1: ParallelStorageArray<RasterSplitReduceData>,
    splitReduces2: ParallelStorageArray<RasterSplitReduceData>,
    numClippedChunks: number,

    // write
    reducibleChunks: ParallelStorageArray<RasterChunk>,
    completeChunks: ParallelStorageArray<RasterCompleteChunk>,
    chunkIndexMap: ParallelStorageArray<number>,

    debugReduces: ParallelStorageArray<RasterSplitReduceData>
  ): Promise<void> {
    const logWorkgroupSize = Math.log2( workgroupSize );

    type WorkgroupValues = {
      reduces: ParallelWorkgroupArray<RasterSplitReduceData>;
      baseIndices: ParallelWorkgroupArray<number>; // [ reducible, complete ], implement with two workgroup values
    };

    const kernel = new ParallelKernel<WorkgroupValues>( async context => {
      await context.start();

      const chunkIndex = context.globalId.x;
      const exists = chunkIndex < numClippedChunks;

      if ( context.localId.x === 0 ) {
        const indices = ParallelUtils.getInclusiveToExclusiveScanIndices( chunkIndex, workgroupSize );

        // Convert to an exclusive scan with the different indices
        const reduce0 = indices.x >= 0 ? ( await splitReduces0.get( context, indices.x ) ) : RasterSplitReduceData.IDENTITY;
        const reduce1 = indices.y >= 0 ? ( await splitReduces1.get( context, indices.y ) ) : RasterSplitReduceData.IDENTITY;
        const reduce2 = indices.z >= 0 ? ( await splitReduces2.get( context, indices.z ) ) : RasterSplitReduceData.IDENTITY;

        const baseReducible = reduce2.numReducible + reduce1.numReducible + reduce0.numReducible;
        const baseComplete = reduce2.numComplete + reduce1.numComplete + reduce0.numComplete;

        await context.workgroupValues.baseIndices.set( context, 0, baseReducible );
        await context.workgroupValues.baseIndices.set( context, 1, baseComplete );

        // We'll have a barrier before we read this due to the scan, so we don't need to worry much about this
      }

      const clippedChunk = await clippedChunks.get( context, chunkIndex );

      const initialValue = exists ? clippedChunk.getSplitReduceData() : RasterSplitReduceData.IDENTITY;
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

      await debugReduces.set( context, context.globalId.x, value );

      if ( exists ) {
        const baseReducible = await context.workgroupValues.baseIndices.get( context, 0 );
        const baseComplete = await context.workgroupValues.baseIndices.get( context, 1 );

        let baseIndex = 0; // filled in later

        if ( clippedChunk.isReducible ) {
          // Convert to exclusive prefix sum
          baseIndex = baseReducible + value.numReducible - initialValue.numReducible;

          await chunkIndexMap.set( context, chunkIndex, baseIndex );

          await reducibleChunks.set( context, baseIndex, new RasterChunk(
            clippedChunk.renderProgramIndex,
            clippedChunk.needsFace,
            clippedChunk.isConstant,
            -1, // filled in later
            -1, // filled in later
            clippedChunk.minX, clippedChunk.minY, clippedChunk.maxX, clippedChunk.maxY,
            clippedChunk.minXCount, clippedChunk.minYCount, clippedChunk.maxXCount, clippedChunk.maxYCount
          ) );
        }

        if ( clippedChunk.isComplete ) {
          // Convert to exclusive prefix sum
          baseIndex = baseComplete + value.numComplete - initialValue.numComplete;

          await chunkIndexMap.set( context, chunkIndex, baseIndex );

          if ( clippedChunk.needsCompleteOutputSplit() ) {
            // NOTE that count should be the same as... the area?
            const count = clippedChunk.outputSplitCount();
            const width = clippedChunk.maxX - clippedChunk.minX;

            for ( let i = 0; i < count; i++ ) {
              const x = clippedChunk.minX + ( i % width );
              const y = clippedChunk.minY + Math.floor( i / width );

              await completeChunks.set( context, baseIndex + i, new RasterCompleteChunk(
                clippedChunk.renderProgramIndex,
                0,
                0,
                clippedChunk.isFullArea,
                1,
                x, y, x + 1, y + 1,
                -1, 1, 1, -1
              ) );
            }
          }
          else {
            await completeChunks.set( context, baseIndex, new RasterCompleteChunk(
              clippedChunk.renderProgramIndex,
              -1, // filled in later
              -1, // filled in later
              clippedChunk.isFullArea,
              clippedChunk.area,
              clippedChunk.minX, clippedChunk.minY, clippedChunk.maxX, clippedChunk.maxY,
              clippedChunk.minXCount, clippedChunk.minYCount, clippedChunk.maxXCount, clippedChunk.maxYCount
            ) );
          }
        }
      }
    }, () => ( {
      reduces: new ParallelWorkgroupArray( _.range( 0, workgroupSize ).map( () => RasterSplitReduceData.INDETERMINATE ), RasterSplitReduceData.INDETERMINATE ),
      baseIndices: new ParallelWorkgroupArray( [ 0, 0 ], 0 )
    } ), [ clippedChunks, splitReduces0, splitReduces1, splitReduces2, reducibleChunks, completeChunks, debugReduces ], workgroupSize );

    await ( new ParallelExecutor( kernel ).dispatch( Math.ceil( numClippedChunks / workgroupSize ) ) );
  }
}

alpenglow.register( 'ParallelRasterSplitScan', ParallelRasterSplitScan );
