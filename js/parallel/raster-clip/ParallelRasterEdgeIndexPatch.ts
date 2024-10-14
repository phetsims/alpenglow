// Copyright 2023-2024, University of Colorado Boulder

/**
 * Updates the edges with the correct chunk indices (clippedChunk => outputChunk) and first/last flags.
 *
 * NOTE: It was possible to attempt to set first/last flags earlier (when we wrote the edges), but it would require
 * more traversal for edges that were fully clipped at the start/end (so they didn't contribute at all). We would
 * instead have to find the first/last "non-degenerate" EdgeClip, so it's just easier to do it here.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, ParallelExecutor, ParallelKernel, ParallelStorageArray, ParallelWorkgroupArray, RasterEdge, RasterSplitReduceData } from '../../imports.js';

export default class ParallelRasterEdgeIndexPatch {
  public static async dispatch(
    workgroupSize: number,
    // read
    chunkIndexMap: ParallelStorageArray<number>,
    chunkIndices: ParallelStorageArray<number>,
    numEdges: number,
    // read-write
    edges: ParallelStorageArray<RasterEdge>
  ): Promise<void> {
    const kernel = new ParallelKernel( async context => {
      await context.start();

      const edgeIndex = context.globalId.x;
      const exists = edgeIndex < numEdges;

      if ( exists ) {
        const edge = await edges.get( context, edgeIndex );
        const clippedChunkIndex = edge.chunkIndex;

        const outputChunkIndex = await chunkIndexMap.get( context, clippedChunkIndex );

        const startIndex = await chunkIndices.get( context, 2 * clippedChunkIndex );
        const endIndex = await chunkIndices.get( context, 2 * clippedChunkIndex + 1 );

        await edges.set( context, edgeIndex, new RasterEdge(
          outputChunkIndex,
          edgeIndex === startIndex,
          edgeIndex === endIndex - 1,
          edge.startPoint,
          edge.endPoint
        ) );
      }
    }, () => ( {
      reduces: new ParallelWorkgroupArray( _.range( 0, workgroupSize ).map( () => RasterSplitReduceData.INDETERMINATE ), RasterSplitReduceData.INDETERMINATE ),
      baseIndices: new ParallelWorkgroupArray( [ 0, 0 ], 0 )
    } ), [ chunkIndexMap, chunkIndices, edges ], workgroupSize );

    await ( new ParallelExecutor( kernel ).dispatch( Math.ceil( numEdges / workgroupSize ) ) );
  }
}

alpenglow.register( 'ParallelRasterEdgeIndexPatch', ParallelRasterEdgeIndexPatch );