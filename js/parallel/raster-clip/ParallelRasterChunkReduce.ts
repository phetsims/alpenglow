// Copyright 2023-2024, University of Colorado Boulder

/**
 * We continue the segmented reduction started in ParallelRasterInitialClip, also applying things to RasterClippedChunks,
 * however we need to track the "left" and "right" values separately.
 *
 * See docs on RasterChunkReduceQuad for the need for "left"/"right"
 *
 * NOTE: The reduction is also completed in ParallelRasterInitialClip, so if changing this file, please check there too
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

      // We need to not double-apply. So we'll only apply when merging into this specific index, since it will
      // (a) be the first combination with the joint "both" result, and (b) it's the simplest to filter for.
      // Note: -5 is different than the "out of range" RasterChunkReduceData value
      const applicableMinChunkIndex = exists && value.leftMin.isLastEdge && !value.leftMin.isFirstEdge ? value.leftMin.clippedChunkIndex : -5;

      for ( let i = 0; i < logWorkgroupSize; i++ ) {
        await context.workgroupBarrier();
        const delta = 1 << i;
        if ( context.localId.x >= delta ) {
          const otherValue = await context.workgroupValues.reduces.get( context, context.localId.x - delta );
          const oldValue = value;

          value = RasterChunkReduceQuad.combine( otherValue, value );

          // NOTE: The similar "max" condition would be identical. It would be
          // |     applicableMaxChunkIndex === otherValue.rightMax.clippedChunkIndex && otherValue.rightMax.isFirstEdge
          // We effectively only need to check and store one of these, since the min/max indices will be essentially
          // just offset by one
          if ( applicableMinChunkIndex === otherValue.rightMin.clippedChunkIndex && otherValue.rightMin.isFirstEdge ) {
            const middleMinReduce = RasterChunkReduceData.combine( otherValue.rightMin, oldValue.leftMin );
            const middleMaxReduce = RasterChunkReduceData.combine( otherValue.rightMax, oldValue.leftMax );

            assert && assert( applicableMinChunkIndex === middleMinReduce.clippedChunkIndex );
            assert && assert( middleMinReduce.isFirstEdge && middleMinReduce.isLastEdge );
            assert && assert( middleMaxReduce.isFirstEdge && middleMaxReduce.isLastEdge );

            const minClippedChunk = await clippedChunks.get( context, middleMinReduce.clippedChunkIndex );
            const maxClippedChunk = await clippedChunks.get( context, middleMaxReduce.clippedChunkIndex );

            await clippedChunks.set( context, middleMinReduce.clippedChunkIndex, middleMinReduce.apply( minClippedChunk ) );
            await clippedChunks.set( context, middleMaxReduce.clippedChunkIndex, middleMaxReduce.apply( maxClippedChunk ) );
          }
        }

        await context.workgroupBarrier();
        await context.workgroupValues.reduces.set( context, context.localId.x, value );
      }

      // Atomically compute the max(localId.x) that has the same clippedChunkIndex as localId.x===0.
      const firstClippedChunkIndex = await context.workgroupValues.firstClippedChunkIndex.get( context, 0 );
      if ( exists && clippedChunkIndex === firstClippedChunkIndex ) {
        context.workgroupValues.atomicMaxFirstReduceIndex = Math.max(
          context.workgroupValues.atomicMaxFirstReduceIndex,
          context.localId.x
        );
      }
      await context.workgroupBarrier(); // for the atomic

      // Store our reduction result
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