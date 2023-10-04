// Copyright 2023, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, ParallelExecutor, ParallelKernel, ParallelStorageArray, ParallelWorkgroupArray, RasterChunkReduceData, RasterChunkReduceQuad, RasterClippedChunk } from '../../imports.js';

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
      reduces: ParallelWorkgroupArray<RasterChunkReduceQuad>;
      firstClippedChunkIndex: ParallelWorkgroupArray<number>; // NOT an array, just using that for atomics. one element, u32
      atomicMaxFirstReduceIndex: number;
    };

    const kernel = new ParallelKernel<WorkgroupValues>( async context => {
      await context.start();

      const reduceIndex = context.globalId.x;
      const exists = reduceIndex < numReduces;

      let value = exists ? await inputChunkReduces.get( context, reduceIndex ) : RasterChunkReduceQuad.OUT_OF_RANGE;

      // Get the "left" index
      const clippedChunkIndex = value.leftMin.clippedChunkIndex;

      // We'll workgroupBarrier at least once below, before this is relevant
      if ( exists && context.localId.x === 0 ) {
        await context.workgroupValues.firstClippedChunkIndex.set( context, 0, clippedChunkIndex );
      }

      await context.workgroupValues.reduces.set( context, context.localId.x, value );

      // TODO: collapse once block is primitive
      // We need to not double-apply. So we'll only apply when merging into this specific index, since it will
      // (a) be the first combination with the joint "both" result, and (b) it's the simplest to filter for.
      // Note: -5 is different than the "out of range" RasterChunkReduceData value
      const appliableMinChunkIndex = exists && value.leftMin.isLastEdge && !value.leftMin.isFirstEdge ? value.leftMin.clippedChunkIndex : -5;
      const appliableMaxChunkIndex = exists && value.leftMax.isLastEdge && !value.leftMax.isFirstEdge ? value.leftMax.clippedChunkIndex : -5;

      for ( let i = 0; i < logWorkgroupSize; i++ ) {
        await context.workgroupBarrier();
        const delta = 1 << i;
        if ( context.localId.x >= delta ) {
          const otherValue = await context.workgroupValues.reduces.get( context, context.localId.x - delta );
          const oldValue = value;

          value = RasterChunkReduceQuad.combine( otherValue, value );

          // TODO: the two if statements are effectively evaluating the same thing (at least assert!)
          // TODO: for the if statements below
          if ( appliableMinChunkIndex === otherValue.rightMin.clippedChunkIndex && otherValue.rightMin.isFirstEdge ) {
            const middleMinReduce = RasterChunkReduceData.combine( otherValue.rightMin, oldValue.leftMin );
            assert && assert( appliableMinChunkIndex === middleMinReduce.clippedChunkIndex );
            assert && assert( middleMinReduce.isFirstEdge && middleMinReduce.isLastEdge );

            // console.log( `minUpdate ${middleMinReduce.clippedChunkIndex}` );
            const minClippedChunk = await clippedChunks.get( context, middleMinReduce.clippedChunkIndex );
            await clippedChunks.set( context, middleMinReduce.clippedChunkIndex, middleMinReduce.apply( minClippedChunk ) );
          }

          if ( appliableMaxChunkIndex === otherValue.rightMax.clippedChunkIndex && otherValue.rightMax.isFirstEdge ) {
            const middleMaxReduce = RasterChunkReduceData.combine( otherValue.rightMax, oldValue.leftMax );
            assert && assert( appliableMaxChunkIndex === middleMaxReduce.clippedChunkIndex );
            assert && assert( middleMaxReduce.isFirstEdge && middleMaxReduce.isLastEdge );

            // console.log( `maxUpdate ${middleMaxReduce.clippedChunkIndex}` );
            const maxClippedChunk = await clippedChunks.get( context, middleMaxReduce.clippedChunkIndex );
            await clippedChunks.set( context, middleMaxReduce.clippedChunkIndex, middleMaxReduce.apply( maxClippedChunk ) );
          }
        }

        await context.workgroupBarrier();
        await context.workgroupValues.reduces.set( context, context.localId.x, value );
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

        const leftValue = await context.workgroupValues.reduces.get( context, context.workgroupValues.atomicMaxFirstReduceIndex );
        const rightValue = await context.workgroupValues.reduces.get( context, lastLocalEdgeIndexInWorkgroup );

        await outputChunkReduces.set( context, context.workgroupId.x, new RasterChunkReduceQuad(
          leftValue.leftMin,
          leftValue.leftMax,
          rightValue.rightMin,
          rightValue.rightMax
        ) );
      }
    }, () => ( {
      reduces: new ParallelWorkgroupArray( _.range( 0, workgroupSize ).map( () => RasterChunkReduceQuad.INDETERMINATE ), RasterChunkReduceQuad.INDETERMINATE ),
      firstClippedChunkIndex: new ParallelWorkgroupArray( [ 0 ], NaN ),
      atomicMaxFirstReduceIndex: 0
    } ), [ clippedChunks, inputChunkReduces, outputChunkReduces ], workgroupSize );

    await ( new ParallelExecutor( kernel ).dispatch( Math.ceil( numReduces / workgroupSize ) ) );
  }
}

alpenglow.register( 'ParallelRasterChunkReduce', ParallelRasterChunkReduce );
