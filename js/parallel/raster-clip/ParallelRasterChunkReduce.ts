// Copyright 2023, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, ParallelExecutor, ParallelKernel, ParallelStorageArray, ParallelWorkgroupArray, RasterChunkReduceData, RasterClippedChunk } from '../../imports.js';

export default class ParallelRasterChunkReduce {
  public static async dispatch(
    workgroupSize: number,

    // input
    clippedChunks: ParallelStorageArray<RasterClippedChunk>,
    inputChunkReduces: ParallelStorageArray<RasterChunkReduceData>,
    numReduces: number,

    // output
    outputChunkReduces: ParallelStorageArray<RasterChunkReduceData>
  ): Promise<void> {
    const logWorkgroupSize = Math.log2( workgroupSize );

    type WorkgroupValues = {
      leftMinReduces: ParallelWorkgroupArray<RasterChunkReduceData>;
      leftMaxReduces: ParallelWorkgroupArray<RasterChunkReduceData>;
      rightMinReduces: ParallelWorkgroupArray<RasterChunkReduceData>;
      rightMaxReduces: ParallelWorkgroupArray<RasterChunkReduceData>;
      firstChunkIndex: ParallelWorkgroupArray<number>; // NOT an array, just using that for atomics. one element, u32
      atomicMaxFirstReduceIndex: number;
    };

    const kernel = new ParallelKernel<WorkgroupValues>( async context => {
      await context.start();

      const workgroupFirstEdgeIndex = context.workgroupId.x * workgroupSize;
      const workgroupLastEdgeIndex = Math.min( workgroupFirstEdgeIndex + workgroupSize - 1, numReduces - 1 );

      const reduceIndex = context.globalId.x;
      const exists = reduceIndex < numReduces;

      let leftMinReduce = await inputChunkReduces.get( context, 4 * context.workgroupId.x );
      let leftMaxReduce = await inputChunkReduces.get( context, 4 * context.workgroupId.x + 1 );
      let rightMinReduce = await inputChunkReduces.get( context, 4 * context.workgroupId.x + 2 );
      let rightMaxReduce = await inputChunkReduces.get( context, 4 * context.workgroupId.x + 3 );

      // Get the "left" index
      const chunkIndex = leftMinReduce.chunkIndex;

      // We'll workgroupBarrier at least once below, before this is relevant
      if ( exists && reduceIndex === workgroupFirstEdgeIndex ) {
        await context.workgroupValues.firstChunkIndex.set( context, 0, chunkIndex );
      }

      await context.workgroupValues.leftMinReduces.set( context, context.localId.x, exists ? leftMinReduce : RasterChunkReduceData.OUT_OF_RANGE );
      await context.workgroupValues.leftMaxReduces.set( context, context.localId.x, exists ? leftMaxReduce : RasterChunkReduceData.OUT_OF_RANGE );
      await context.workgroupValues.rightMinReduces.set( context, context.localId.x, exists ? rightMinReduce : RasterChunkReduceData.OUT_OF_RANGE );
      await context.workgroupValues.rightMaxReduces.set( context, context.localId.x, exists ? rightMaxReduce : RasterChunkReduceData.OUT_OF_RANGE );

      // TODO: Think about the cases! We have three somewhat independent things when merging
      // TODO: 1 the left/right of the "other" (left)
      // TODO: 2 the left/right of "ours" (right)
      // TODO: 3. the right/left in the middle
      // TODO: we'll want to STORE... the left-left and right-right (BUT... the combined versions)?
      // TODO: think about combinations, work out all of the cases
      // TODO: think about internal behavior desired, AND external behavior
      // TODO: when do we apply? (don't double-apply!)
      // TODO: Don't double-apply!

      for ( let i = 0; i < logWorkgroupSize; i++ ) {
        await context.workgroupBarrier();
        const delta = 1 << i;
        if ( context.localId.x >= delta ) {
          // TODO: the two if statements are effectively evaluating the same thing (at least assert!)
          const otherLeftMinReduce = await context.workgroupValues.leftMinReduces.get( context, context.localId.x - delta );
          const otherRightMinReduce = await context.workgroupValues.rightMinReduces.get( context, context.localId.x - delta );
          const middleMinReduce = RasterChunkReduceData.combine( otherRightMinReduce, leftMinReduce );
          leftMinReduce = otherLeftMinReduce.chunkIndex === leftMinReduce.chunkIndex ? RasterChunkReduceData.combine( otherLeftMinReduce, leftMinReduce ) : otherLeftMinReduce;
          rightMinReduce = RasterChunkReduceData.combine( otherRightMinReduce, rightMinReduce );
          if ( middleMinReduce.chunkIndex === otherRightMinReduce.chunkIndex && middleMinReduce.isFirstEdge && middleMinReduce.isLastEdge ) {
            const minClippedChunk = await clippedChunks.get( context, middleMinReduce.chunkIndex );
            await clippedChunks.set( context, middleMinReduce.chunkIndex, middleMinReduce.apply( minClippedChunk ) );
          }

          const otherLeftMaxReduce = await context.workgroupValues.leftMaxReduces.get( context, context.localId.x - delta );
          const otherRightMaxReduce = await context.workgroupValues.rightMaxReduces.get( context, context.localId.x - delta );
          const middleMaxReduce = RasterChunkReduceData.combine( otherRightMaxReduce, leftMaxReduce );
          leftMaxReduce = otherLeftMaxReduce.chunkIndex === leftMaxReduce.chunkIndex ? RasterChunkReduceData.combine( otherLeftMaxReduce, leftMaxReduce ) : otherLeftMaxReduce;
          rightMaxReduce = RasterChunkReduceData.combine( otherRightMaxReduce, rightMaxReduce );
          if ( middleMaxReduce.chunkIndex === otherRightMaxReduce.chunkIndex && middleMaxReduce.isFirstEdge && middleMaxReduce.isLastEdge ) {
            const maxClippedChunk = await clippedChunks.get( context, middleMaxReduce.chunkIndex );
            await clippedChunks.set( context, middleMaxReduce.chunkIndex, middleMaxReduce.apply( maxClippedChunk ) );
          }
        }

        await context.workgroupBarrier();
        await context.workgroupValues.leftMinReduces.set( context, context.localId.x, leftMinReduce );
        await context.workgroupValues.leftMaxReduces.set( context, context.localId.x, leftMaxReduce );
        await context.workgroupValues.rightMinReduces.set( context, context.localId.x, rightMinReduce );
        await context.workgroupValues.rightMaxReduces.set( context, context.localId.x, rightMaxReduce );
      }

      const firstChunkIndex = await context.workgroupValues.firstChunkIndex.get( context, 0 );
      if ( exists && chunkIndex === firstChunkIndex ) {
        context.workgroupValues.atomicMaxFirstReduceIndex = Math.max(
          context.workgroupValues.atomicMaxFirstReduceIndex,
          context.localId.x
        );
      }

      await context.workgroupBarrier(); // for the atomic

      if ( exists && context.localId.x === context.workgroupValues.atomicMaxFirstReduceIndex ) {
        await outputChunkReduces.set( context, 4 * context.workgroupId.x, leftMinReduce );
        await outputChunkReduces.set( context, 4 * context.workgroupId.x + 1, leftMaxReduce );
      }
      if ( exists && context.localId.x === workgroupLastEdgeIndex ) {
        await outputChunkReduces.set( context, 4 * context.workgroupId.x + 2, rightMinReduce );
        await outputChunkReduces.set( context, 4 * context.workgroupId.x + 3, rightMaxReduce );
      }
    }, () => ( {
      leftMinReduces: new ParallelWorkgroupArray( _.range( 0, workgroupSize ).map( () => RasterChunkReduceData.INDETERMINATE ), RasterChunkReduceData.INDETERMINATE ),
      leftMaxReduces: new ParallelWorkgroupArray( _.range( 0, workgroupSize ).map( () => RasterChunkReduceData.INDETERMINATE ), RasterChunkReduceData.INDETERMINATE ),
      rightMinReduces: new ParallelWorkgroupArray( _.range( 0, workgroupSize ).map( () => RasterChunkReduceData.INDETERMINATE ), RasterChunkReduceData.INDETERMINATE ),
      rightMaxReduces: new ParallelWorkgroupArray( _.range( 0, workgroupSize ).map( () => RasterChunkReduceData.INDETERMINATE ), RasterChunkReduceData.INDETERMINATE ),
      firstChunkIndex: new ParallelWorkgroupArray( [ 0 ], NaN ),
      atomicMaxFirstReduceIndex: 0
    } ), [ clippedChunks, inputChunkReduces, outputChunkReduces ], workgroupSize );

    await ( new ParallelExecutor( kernel ).dispatch( Math.ceil( numReduces / workgroupSize ) ) );
  }
}

alpenglow.register( 'ParallelRasterChunkReduce', ParallelRasterChunkReduce );
