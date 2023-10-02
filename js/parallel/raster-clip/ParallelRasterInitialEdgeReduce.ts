// Copyright 2023, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, ParallelExecutor, ParallelKernel, ParallelStorageArray, ParallelWorkgroupArray, RasterClippedChunk, RasterEdgeClip, RasterSplitReduceData } from '../../imports.js';

export default class ParallelRasterInitialEdgeReduce {
  public static async dispatch(
    workgroupSize: number,

    // read
    clippedChunks: ParallelStorageArray<RasterClippedChunk>,
    edgeClips: ParallelStorageArray<RasterEdgeClip>,
    numEdgeClips: number,

    // write
    debugFullEdgeReduces: ParallelStorageArray<RasterSplitReduceData>,
    edgeReduces: ParallelStorageArray<RasterSplitReduceData>
  ): Promise<void> {
    const logWorkgroupSize = Math.log2( workgroupSize );

    type WorkgroupValues = {
      reduces: ParallelWorkgroupArray<RasterSplitReduceData>;
    };

    const kernel = new ParallelKernel<WorkgroupValues>( async context => {
      await context.start();

      const edgeIndex = context.globalId.x;
      const exists = edgeIndex < numEdgeClips; // we have 2 clips for each edge

      const edgeClip = await edgeClips.get( context, context.globalId.x );
      const clippedChunk = await clippedChunks.get( context, edgeClip.chunkIndex );

      let value = RasterSplitReduceData.from( edgeClip, clippedChunk, exists );

      await context.workgroupValues.reduces.set( context, context.localId.x, value );

      await debugFullEdgeReduces.set( context, context.globalId.x, value );

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
        await edgeReduces.set( context, context.workgroupId.x, value );
      }
    }, () => ( {
      reduces: new ParallelWorkgroupArray( _.range( 0, workgroupSize ).map( () => RasterSplitReduceData.INDETERMINATE ), RasterSplitReduceData.INDETERMINATE )
    } ), [ clippedChunks, edgeClips, debugFullEdgeReduces, edgeReduces ], workgroupSize );

    await ( new ParallelExecutor( kernel ).dispatch( Math.ceil( numEdgeClips / workgroupSize ) ) );
  }
}

alpenglow.register( 'ParallelRasterInitialEdgeReduce', ParallelRasterInitialEdgeReduce );
