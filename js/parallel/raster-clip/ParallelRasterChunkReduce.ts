// Copyright 2023, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, ParallelExecutor, ParallelKernel, ParallelStorageArray, ParallelWorkgroupArray, RasterChunkReduceQuad, RasterChunkReduceData, RasterClippedChunk } from '../../imports.js';

export default class ParallelRasterChunkReduce {
  public static async dispatch(
    workgroupSize: number,

    // read
    inputChunkReduces: ParallelStorageArray<RasterChunkReduceQuad>,
    numReduces: number,

    // read-write
    clippedChunks: ParallelStorageArray<RasterClippedChunk>,

    // write
    outputChunkReduces: ParallelStorageArray<RasterChunkReduceQuad>
  ): Promise<void> {
    const logWorkgroupSize = Math.log2( workgroupSize );

    type WorkgroupValues = {
      leftMinReduces: ParallelWorkgroupArray<RasterChunkReduceData>;
      leftMaxReduces: ParallelWorkgroupArray<RasterChunkReduceData>;
      rightMinReduces: ParallelWorkgroupArray<RasterChunkReduceData>;
      rightMaxReduces: ParallelWorkgroupArray<RasterChunkReduceData>;
      firstClippedChunkIndex: ParallelWorkgroupArray<number>; // NOT an array, just using that for atomics. one element, u32
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
      const clippedChunkIndex = reduceBlock.leftMin.clippedChunkIndex;

      // We'll workgroupBarrier at least once below, before this is relevant
      if ( exists && context.localId.x === 0 ) {
        await context.workgroupValues.firstClippedChunkIndex.set( context, 0, clippedChunkIndex );
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
      const appliableMinChunkIndex = exists && leftMinReduce.isLastEdge && !leftMinReduce.isFirstEdge ? leftMinReduce.clippedChunkIndex : -5;
      const appliableMaxChunkIndex = exists && leftMaxReduce.isLastEdge && !leftMaxReduce.isFirstEdge ? leftMaxReduce.clippedChunkIndex : -5;

      for ( let i = 0; i < logWorkgroupSize; i++ ) {
        await context.workgroupBarrier();
        const delta = 1 << i;
        if ( context.localId.x >= delta ) {
          // TODO: the two if statements are effectively evaluating the same thing (at least assert!)
          const otherLeftMinReduce = await context.workgroupValues.leftMinReduces.get( context, context.localId.x - delta );
          const otherRightMinReduce = await context.workgroupValues.rightMinReduces.get( context, context.localId.x - delta );
          const oldLeftMinReduce = leftMinReduce;
          leftMinReduce = otherLeftMinReduce.clippedChunkIndex === leftMinReduce.clippedChunkIndex ? RasterChunkReduceData.combine( otherLeftMinReduce, leftMinReduce ) : otherLeftMinReduce;
          rightMinReduce = RasterChunkReduceData.combine( otherRightMinReduce, rightMinReduce );

          if ( appliableMinChunkIndex === otherRightMinReduce.clippedChunkIndex && otherRightMinReduce.isFirstEdge ) {
            const middleMinReduce = RasterChunkReduceData.combine( otherRightMinReduce, oldLeftMinReduce );
            assert && assert( appliableMinChunkIndex === middleMinReduce.clippedChunkIndex );
            assert && assert( middleMinReduce.isFirstEdge && middleMinReduce.isLastEdge );

            // console.log( `minUpdate ${middleMinReduce.clippedChunkIndex}` );
            const minClippedChunk = await clippedChunks.get( context, middleMinReduce.clippedChunkIndex );
            await clippedChunks.set( context, middleMinReduce.clippedChunkIndex, middleMinReduce.apply( minClippedChunk ) );
          }

          const otherLeftMaxReduce = await context.workgroupValues.leftMaxReduces.get( context, context.localId.x - delta );
          const otherRightMaxReduce = await context.workgroupValues.rightMaxReduces.get( context, context.localId.x - delta );
          const oldLeftMaxReduce = leftMaxReduce;
          leftMaxReduce = otherLeftMaxReduce.clippedChunkIndex === leftMaxReduce.clippedChunkIndex ? RasterChunkReduceData.combine( otherLeftMaxReduce, leftMaxReduce ) : otherLeftMaxReduce;
          rightMaxReduce = RasterChunkReduceData.combine( otherRightMaxReduce, rightMaxReduce );

          if ( appliableMaxChunkIndex === otherRightMaxReduce.clippedChunkIndex && otherRightMaxReduce.isFirstEdge ) {
            const middleMaxReduce = RasterChunkReduceData.combine( otherRightMaxReduce, oldLeftMaxReduce );
            assert && assert( appliableMaxChunkIndex === middleMaxReduce.clippedChunkIndex );
            assert && assert( middleMaxReduce.isFirstEdge && middleMaxReduce.isLastEdge );

            // console.log( `maxUpdate ${middleMaxReduce.clippedChunkIndex}` );
            const maxClippedChunk = await clippedChunks.get( context, middleMaxReduce.clippedChunkIndex );
            await clippedChunks.set( context, middleMaxReduce.clippedChunkIndex, middleMaxReduce.apply( maxClippedChunk ) );
          }
        }

        await context.workgroupBarrier();
        await context.workgroupValues.leftMinReduces.set( context, context.localId.x, leftMinReduce );
        await context.workgroupValues.leftMaxReduces.set( context, context.localId.x, leftMaxReduce );
        await context.workgroupValues.rightMinReduces.set( context, context.localId.x, rightMinReduce );
        await context.workgroupValues.rightMaxReduces.set( context, context.localId.x, rightMaxReduce );
      }

      const firstClippedChunkIndex = await context.workgroupValues.firstClippedChunkIndex.get( context, 0 );
      if ( exists && clippedChunkIndex === firstClippedChunkIndex ) {
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

        await outputChunkReduces.set( context, context.workgroupId.x, new RasterChunkReduceQuad(
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
      firstClippedChunkIndex: new ParallelWorkgroupArray( [ 0 ], NaN ),
      atomicMaxFirstReduceIndex: 0
    } ), [ clippedChunks, inputChunkReduces, outputChunkReduces ], workgroupSize );

    await ( new ParallelExecutor( kernel ).dispatch( Math.ceil( numReduces / workgroupSize ) ) );
  }
}

alpenglow.register( 'ParallelRasterChunkReduce', ParallelRasterChunkReduce );
