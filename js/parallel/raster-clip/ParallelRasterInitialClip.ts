// Copyright 2023, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, EdgedClippedFace, ParallelExecutor, ParallelKernel, ParallelStorageArray, RasterChunk, RasterChunkReduceData, RasterEdge, RasterEdgeClip } from '../../imports.js';

export default class ParallelRasterInitialClip {
  public static async dispatch(
    // input
    chunks: ParallelStorageArray<RasterChunk>,
    edges: ParallelStorageArray<RasterEdge>,

    // output
    edgeClips: ParallelStorageArray<RasterEdgeClip>,
    chunkReduces: ParallelStorageArray<RasterChunkReduceData>
  ): Promise<void> {
    const workgroupSize = 256;

    const kernel = new ParallelKernel( async context => {
      await context.start();

      const edgeIndex = context.globalId.x;
      const edge = await edges.get( context, edgeIndex );
      const chunk = await chunks.get( context, edge.chunkIndex );

      const minEdgeIndex = edgeIndex;
      const maxEdgeIndex = 2 * edgeIndex;
      const minChunkIndex = 2 * edge.chunkIndex;
      const maxChunkIndex = 2 * edge.chunkIndex + 1;

      const xDiff = chunk.maxX - chunk.minX;
      const yDiff = chunk.maxY - chunk.minY;

      const isXSplit = xDiff > yDiff;

      // NOTE: This is set up so that if we have a half-pixel offset e.g. with a bilinear filter, it will work)
      const split = isXSplit ? chunk.minX + Math.floor( 0.5 * xDiff ) : chunk.minY + Math.floor( 0.5 * yDiff );

      // TODO: get efficient conversion that won't care about orientation (with pre-post conversion)
      const face = new EdgedClippedFace(
        [],
        chunk.minX, chunk.minY, chunk.maxX, chunk.maxY,
        0, 0, 0, 0
      );
      const { minFace, maxFace } = isXSplit ? face.getBinaryXClip( split, NaN ) : face.getBinaryYClip( split, NaN );
      const minClip = RasterEdgeClip.fromEdges( minFace.edges, edge.isFirstEdge );
      const maxClip = RasterEdgeClip.fromEdges( maxFace.edges, edge.isFirstEdge );

      const minArea = minClip.getArea();
      const maxArea = maxClip.getArea();

      const minReduce = isXSplit ? new RasterChunkReduceData(
        minChunkIndex,
        minArea,
        chunk.minX, chunk.minY, split, chunk.maxY,
        minFace.minXCount, minFace.minYCount, minFace.maxXCount, minFace.maxYCount
      ) : new RasterChunkReduceData(
        minChunkIndex,
        minArea,
        chunk.minX, chunk.minY, chunk.maxX, split,
        minFace.minXCount, minFace.minYCount, minFace.maxXCount, minFace.maxYCount
      );

      const maxReduce = isXSplit ? new RasterChunkReduceData(
        maxChunkIndex,
        maxArea,
        split, chunk.minY, chunk.maxX, chunk.maxY,
        maxFace.minXCount, maxFace.minYCount, maxFace.maxXCount, maxFace.maxYCount
      ) : new RasterChunkReduceData(
        maxChunkIndex,
        maxArea,
        chunk.minX, split, chunk.maxX, chunk.maxY,
        maxFace.minXCount, maxFace.minYCount, maxFace.maxXCount, maxFace.maxYCount
      );

      await edgeClips.set( context, minEdgeIndex, minClip );
      await edgeClips.set( context, maxEdgeIndex, maxClip );
      await chunkReduces.set( context, minChunkIndex, minReduce );
      await chunkReduces.set( context, maxChunkIndex, maxReduce );

    }, () => ( {} ), [ chunks, edges, edgeClips, chunkReduces ], workgroupSize );

    await ( new ParallelExecutor( kernel ).dispatch( Math.ceil( edges.data.length / workgroupSize ) ) );
  }
}

alpenglow.register( 'ParallelRasterInitialClip', ParallelRasterInitialClip );
