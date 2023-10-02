// Copyright 2023, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, ParallelExecutor, ParallelKernel, ParallelStorageArray, ParallelWorkgroupArray, RasterClippedChunk, RasterEdgeClip, RasterEdgeReduceData } from '../../imports.js';

export default class ParallelRasterInitialEdgeReduce {
  public static async dispatch(
    workgroupSize: number,

    // input
    clippedChunks: ParallelStorageArray<RasterClippedChunk>,
    edgeClips: ParallelStorageArray<RasterEdgeClip>,
    numEdges: number,
    numChunks: number,

    // output
    debugFullEdgeReduces: ParallelStorageArray<RasterEdgeReduceData>,
    edgeReduces: ParallelStorageArray<RasterEdgeReduceData>
  ): Promise<void> {
    const logWorkgroupSize = Math.log2( workgroupSize );

    type WorkgroupValues = {
      reduces: ParallelWorkgroupArray<RasterEdgeReduceData>;
    };

    const kernel = new ParallelKernel<WorkgroupValues>( async context => {
      await context.start();

      const edgeIndex = context.globalId.x;
      const exists = edgeIndex < numEdges * 2; // we have 2 clips for each edge

      const edgeClip = await edgeClips.get( context, context.globalId.x );
      const clippedChunk = await clippedChunks.get( context, edgeClip.chunkIndex );
      const isReducible = clippedChunk.isReducible;
      const isComplete = clippedChunk.isComplete;
      const count = exists ? edgeClip.getCount() : 0;

      let value = new RasterEdgeReduceData(
        isReducible ? count : 0,
        isComplete ? count : 0
      );

      await context.workgroupValues.reduces.set( context, context.localId.x, value );

      await debugFullEdgeReduces.set( context, context.globalId.x, value );

      for ( let i = 0; i < logWorkgroupSize; i++ ) {
        await context.workgroupBarrier();
        const delta = 1 << i;
        if ( context.localId.x >= delta ) {
          const other = await context.workgroupValues.reduces.get( context, context.localId.x - delta );
          value = RasterEdgeReduceData.combine( other, value );
        }

        await context.workgroupBarrier();
        await context.workgroupValues.reduces.set( context, context.localId.x, value );
      }

      if ( context.localId.x === workgroupSize - 1 ) {
        await edgeReduces.set( context, context.workgroupId.x, value );
      }
    }, () => ( {
      reduces: new ParallelWorkgroupArray( _.range( 0, workgroupSize ).map( () => RasterEdgeReduceData.INDETERMINATE ), RasterEdgeReduceData.INDETERMINATE )
    } ), [ clippedChunks, edgeClips, debugFullEdgeReduces, edgeReduces ], workgroupSize );

    await ( new ParallelExecutor( kernel ).dispatch( Math.ceil( numEdges * 2 / workgroupSize ) ) );
  }
}

alpenglow.register( 'ParallelRasterInitialEdgeReduce', ParallelRasterInitialEdgeReduce );
