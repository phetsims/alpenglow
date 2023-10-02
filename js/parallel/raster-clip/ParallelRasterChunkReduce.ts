// Copyright 2023, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, ParallelExecutor, ParallelKernel, ParallelStorageArray, ParallelWorkgroupArray, RasterChunkReduceBlock, RasterChunkReduceData, RasterClippedChunk } from '../../imports.js';

export default class ParallelRasterChunkReduce {
  public static async dispatch(
    workgroupSize: number,

    // read
    inputChunkReduces: ParallelStorageArray<RasterChunkReduceBlock>,
    numReduces: number,

    // read-write
    clippedChunks: ParallelStorageArray<RasterClippedChunk>,

    // write
    outputChunkReduces: ParallelStorageArray<RasterChunkReduceBlock>
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

      const reduceIndex = context.globalId.x;
      const exists = reduceIndex < numReduces;

      // TODO: fix this to work with blocks as primitives
      const reduceBlock = await inputChunkReduces.get( context, reduceIndex );
      let leftMinReduce = exists ? reduceBlock.leftMin : RasterChunkReduceData.OUT_OF_RANGE;
      let leftMaxReduce = exists ? reduceBlock.leftMax : RasterChunkReduceData.OUT_OF_RANGE;
      let rightMinReduce = exists ? reduceBlock.rightMin : RasterChunkReduceData.OUT_OF_RANGE;
      let rightMaxReduce = exists ? reduceBlock.rightMax : RasterChunkReduceData.OUT_OF_RANGE;

      // Get the "left" index
      const chunkIndex = reduceBlock.leftMin.chunkIndex;

      // We'll workgroupBarrier at least once below, before this is relevant
      if ( exists && context.localId.x === 0 ) {
        await context.workgroupValues.firstChunkIndex.set( context, 0, chunkIndex );
      }

      // TODO: fix this to work with blocks as primitives
      // TODO: THEY SHOULD have the same chunks, right?!?
      // TODO: blocks as primitives!!!!
      await context.workgroupValues.leftMinReduces.set( context, context.localId.x, leftMinReduce );
      await context.workgroupValues.leftMaxReduces.set( context, context.localId.x, leftMaxReduce );
      await context.workgroupValues.rightMinReduces.set( context, context.localId.x, rightMinReduce );
      await context.workgroupValues.rightMaxReduces.set( context, context.localId.x, rightMaxReduce );

      // TODO: collapse once block is primitive
      // We need to not double-apply. So we'll only apply when merging into this specific index, since it will
      // (a) be the first combination with the joint "both" result, and (b) it's the simplest to filter for.
      // Note: -5 is different than the "out of range" RasterChunkReduceData value
      const appliableMinChunkIndex = exists && leftMinReduce.isLastEdge && !leftMinReduce.isFirstEdge ? leftMinReduce.chunkIndex : -5;
      const appliableMaxChunkIndex = exists && leftMaxReduce.isLastEdge && !leftMaxReduce.isFirstEdge ? leftMaxReduce.chunkIndex : -5;

      for ( let i = 0; i < logWorkgroupSize; i++ ) {
        await context.workgroupBarrier();
        const delta = 1 << i;
        if ( context.localId.x >= delta ) {
          // TODO: the two if statements are effectively evaluating the same thing (at least assert!)
          const otherLeftMinReduce = await context.workgroupValues.leftMinReduces.get( context, context.localId.x - delta );
          const otherRightMinReduce = await context.workgroupValues.rightMinReduces.get( context, context.localId.x - delta );
          const oldLeftMinReduce = leftMinReduce;
          leftMinReduce = otherLeftMinReduce.chunkIndex === leftMinReduce.chunkIndex ? RasterChunkReduceData.combine( otherLeftMinReduce, leftMinReduce ) : otherLeftMinReduce;
          rightMinReduce = RasterChunkReduceData.combine( otherRightMinReduce, rightMinReduce );

          if ( appliableMinChunkIndex === otherRightMinReduce.chunkIndex && otherRightMinReduce.isFirstEdge ) {
            const middleMinReduce = RasterChunkReduceData.combine( otherRightMinReduce, oldLeftMinReduce );
            assert && assert( appliableMinChunkIndex === middleMinReduce.chunkIndex );
            assert && assert( middleMinReduce.isFirstEdge && middleMinReduce.isLastEdge );

            // console.log( `minUpdate ${middleMinReduce.chunkIndex}` );
            const minClippedChunk = await clippedChunks.get( context, middleMinReduce.chunkIndex );
            await clippedChunks.set( context, middleMinReduce.chunkIndex, middleMinReduce.apply( minClippedChunk ) );
          }

          const otherLeftMaxReduce = await context.workgroupValues.leftMaxReduces.get( context, context.localId.x - delta );
          const otherRightMaxReduce = await context.workgroupValues.rightMaxReduces.get( context, context.localId.x - delta );
          const oldLeftMaxReduce = leftMaxReduce;
          leftMaxReduce = otherLeftMaxReduce.chunkIndex === leftMaxReduce.chunkIndex ? RasterChunkReduceData.combine( otherLeftMaxReduce, leftMaxReduce ) : otherLeftMaxReduce;
          rightMaxReduce = RasterChunkReduceData.combine( otherRightMaxReduce, rightMaxReduce );

          if ( appliableMaxChunkIndex === otherRightMaxReduce.chunkIndex && otherRightMaxReduce.isFirstEdge ) {
            const middleMaxReduce = RasterChunkReduceData.combine( otherRightMaxReduce, oldLeftMaxReduce );
            assert && assert( appliableMaxChunkIndex === middleMaxReduce.chunkIndex );
            assert && assert( middleMaxReduce.isFirstEdge && middleMaxReduce.isLastEdge );

            // console.log( `maxUpdate ${middleMaxReduce.chunkIndex}` );
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

      if ( exists && context.localId.x === 0 ) {
        const lastLocalEdgeIndexInWorkgroup = Math.min(
          numReduces - 1 - context.workgroupId.x * workgroupSize,
          workgroupSize - 1
        );

        await outputChunkReduces.set( context, context.workgroupId.x, new RasterChunkReduceBlock(
          await context.workgroupValues.leftMinReduces.get( context, context.workgroupValues.atomicMaxFirstReduceIndex ),
          await context.workgroupValues.leftMaxReduces.get( context, context.workgroupValues.atomicMaxFirstReduceIndex ),
          await context.workgroupValues.rightMinReduces.get( context, lastLocalEdgeIndexInWorkgroup ),
          await context.workgroupValues.rightMaxReduces.get( context, lastLocalEdgeIndexInWorkgroup )
        ) );
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
