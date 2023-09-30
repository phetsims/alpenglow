// Copyright 2023, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, ParallelRasterInitialClip, ParallelStorageArray, RasterChunk, RasterChunkReduceData, RasterEdge, RasterEdgeClip } from '../../imports.js';
import Vector2 from '../../../../dot/js/Vector2.js';

export default class ParallelRaster {
  public static async test(): Promise<void> {
    const inputChunks = new ParallelStorageArray( [
      new RasterChunk(
        0,
        false,
        false,
        0,
        5,
        0, 0, 10, 10,
        -1, 1, 0, 0
      ),
      new RasterChunk(
        1,
        false,
        false,
        0,
        3,
        10, 0, 20, 10,
        0, 1, 0, 0
      )
    ], RasterChunk.INDETERMINATE );

    const inputEdges = new ParallelStorageArray( [
      new RasterEdge(
        0,
        true,
        new Vector2( 10, 0 ),
        new Vector2( 10, 6 )
      ),
      new RasterEdge(
        0,
        false,
        new Vector2( 10, 6 ),
        new Vector2( 0, 10 )
      ),
      new RasterEdge(
        0,
        false,
        new Vector2( 1, 1 ),
        new Vector2( 7, 6 )
      ),
      new RasterEdge(
        0,
        false,
        new Vector2( 7, 6 ),
        new Vector2( 4, 2 )
      ),
      new RasterEdge(
        0,
        false,
        new Vector2( 4, 2 ),
        new Vector2( 1, 1 )
      ),
      new RasterEdge(
        1,
        true,
        new Vector2( 20, 0 ),
        new Vector2( 20, 2 )
      ),
      new RasterEdge(
        1,
        false,
        new Vector2( 20, 2 ),
        new Vector2( 10, 6 )
      ),
      new RasterEdge(
        1,
        false,
        new Vector2( 10, 6 ),
        new Vector2( 10, 0 )
      )
    ], RasterEdge.INDETERMINATE );

    const outputChunks = new ParallelStorageArray( _.range( 0, 1024 ).map( () => RasterChunk.INDETERMINATE ), RasterChunk.INDETERMINATE );
    const outputEdges = new ParallelStorageArray( _.range( 0, 4096 ).map( () => RasterEdge.INDETERMINATE ), RasterEdge.INDETERMINATE );

    await ParallelRaster.process( inputChunks, inputEdges, outputChunks, outputEdges );
  }

  public static async process(
    // input
    inputChunks: ParallelStorageArray<RasterChunk>,
    inputEdges: ParallelStorageArray<RasterEdge>,

    // output
    outputChunks: ParallelStorageArray<RasterChunk>,
    outputEdges: ParallelStorageArray<RasterEdge>

    // TODO: add the shipped output
  ): Promise<void> {
    const edgeClips0 = new ParallelStorageArray( _.range( 0, 1024 ).map( () => RasterEdgeClip.INDETERMINATE ), RasterEdgeClip.INDETERMINATE );
    const chunkReduces0 = new ParallelStorageArray( _.range( 0, 1024 ).map( () => RasterChunkReduceData.INDETERMINATE ), RasterChunkReduceData.INDETERMINATE );

    await ParallelRasterInitialClip.dispatch( inputChunks, inputEdges, inputEdges.data.length, edgeClips0, chunkReduces0 );

    // TODO: the rest of the processing
  }
}

alpenglow.register( 'ParallelRaster', ParallelRaster );
