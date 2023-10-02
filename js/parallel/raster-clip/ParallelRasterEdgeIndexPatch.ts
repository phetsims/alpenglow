// Copyright 2023, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, ParallelExecutor, ParallelKernel, ParallelStorageArray, ParallelWorkgroupArray, RasterEdge, RasterSplitReduceData } from '../../imports.js';

export default class ParallelRasterEdgeIndexPatch {
  public static async dispatch(
    workgroupSize: number,

    // input
    chunkIndexMap: ParallelStorageArray<number>,
    chunkIndices: ParallelStorageArray<number>,
    edges: ParallelStorageArray<RasterEdge>, // mutated
    numEdges: number
  ): Promise<void> {
    const kernel = new ParallelKernel( async context => {
      await context.start();

      // TODO: code share with edge scan?
      const edgeIndex = context.globalId.x;
      const exists = edgeIndex < numEdges;

      if ( exists ) {
        const edge = await edges.get( context, edgeIndex );
        // TODO: use name clippedChunkIndex through more code
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
