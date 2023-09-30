// Copyright 2023, University of Colorado Boulder

/**
 * Rasterization prototype for WebGPU, but using the parallel (debuggable) API.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, ParallelRasterChunkReduce, ParallelRasterInitialChunk, ParallelRasterInitialClip, ParallelStorageArray, RasterChunk, RasterChunkReduceData, RasterClippedChunk, RasterEdge, RasterEdgeClip } from '../../imports.js';
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
        false,
        new Vector2( 10, 0 ),
        new Vector2( 10, 6 )
      ),
      new RasterEdge(
        0,
        false,
        false,
        new Vector2( 10, 6 ),
        new Vector2( 0, 10 )
      ),
      new RasterEdge(
        0,
        false,
        false,
        new Vector2( 1, 1 ),
        new Vector2( 3, 6 )
      ),
      new RasterEdge(
        0,
        false,
        false,
        new Vector2( 3, 6 ),
        new Vector2( 4, 2 )
      ),
      new RasterEdge(
        0,
        false,
        true,
        new Vector2( 4, 2 ),
        new Vector2( 1, 1 )
      ),
      new RasterEdge(
        1,
        true,
        false,
        new Vector2( 20, 0 ),
        new Vector2( 20, 2 )
      ),
      new RasterEdge(
        1,
        false,
        false,
        new Vector2( 20, 2 ),
        new Vector2( 10, 6 )
      ),
      new RasterEdge(
        1,
        false,
        true,
        new Vector2( 10, 6 ),
        new Vector2( 10, 0 )
      )
    ], RasterEdge.INDETERMINATE );

    const outputChunks = new ParallelStorageArray( _.range( 0, 1024 ).map( () => RasterChunk.INDETERMINATE ), RasterChunk.INDETERMINATE );
    const outputEdges = new ParallelStorageArray( _.range( 0, 4096 ).map( () => RasterEdge.INDETERMINATE ), RasterEdge.INDETERMINATE );

    // TODO: change back to 256 once we are done testing
    await ParallelRaster.process( 2, inputChunks.data.length, inputEdges.data.length, inputChunks, inputEdges, outputChunks, outputEdges );
  }

  public static async process(
    workgroupSize: number,
    numInputChunks: number,
    numInputEdges: number,

    // input
    inputChunks: ParallelStorageArray<RasterChunk>,
    inputEdges: ParallelStorageArray<RasterEdge>,

    // output
    outputChunks: ParallelStorageArray<RasterChunk>,
    outputEdges: ParallelStorageArray<RasterEdge>

    // TODO: add the shipped output
  ): Promise<void> {
    const toIndexedString = ( n: { toString(): string }, i: number ) => `${i} ${n.toString()}`;

    console.log( `numInputChunks: ${numInputChunks}` );
    console.log( inputChunks.data.slice( 0, numInputChunks ).map( toIndexedString ).join( '\n' ) );

    console.log( `numInputEdges: ${numInputEdges}` );
    console.log( inputEdges.data.slice( 0, numInputEdges ).map( toIndexedString ).join( '\n' ) );

    const clippedChunks = new ParallelStorageArray( _.range( 0, 4096 ).map( () => RasterClippedChunk.INDETERMINATE ), RasterClippedChunk.INDETERMINATE );
    await ParallelRasterInitialChunk.dispatch( workgroupSize, inputChunks, numInputChunks, clippedChunks );

    console.log( 'clippedChunks (without reduce)' );
    console.log( clippedChunks.data.slice( 0, numInputChunks * 2 ).map( toIndexedString ).join( '\n' ) );

    const edgeClips0 = new ParallelStorageArray( _.range( 0, 1024 ).map( () => RasterEdgeClip.INDETERMINATE ), RasterEdgeClip.INDETERMINATE );
    const chunkReduces0 = new ParallelStorageArray( _.range( 0, 4096 ).map( () => RasterChunkReduceData.INDETERMINATE ), RasterChunkReduceData.INDETERMINATE );
    const debugFullChunkReduces = new ParallelStorageArray( _.range( 0, 4096 ).map( () => ( { min: RasterChunkReduceData.INDETERMINATE, max: RasterChunkReduceData.INDETERMINATE } ) ), { min: RasterChunkReduceData.INDETERMINATE, max: RasterChunkReduceData.INDETERMINATE } );
    await ParallelRasterInitialClip.dispatch( workgroupSize, inputChunks, inputEdges, clippedChunks, numInputEdges, edgeClips0, chunkReduces0, debugFullChunkReduces );

    console.log( 'edgeClips0' );
    console.log( edgeClips0.data.slice( 0, numInputEdges * 2 ).map( toIndexedString ).join( '\n' ) );

    console.log( 'debugFullChunkReduces' );
    console.log( debugFullChunkReduces.data.slice( 0, numInputEdges ).flatMap( ( n, i ) => [
      `${i} min: ${n.min.toString()}`,
      `${i.toString().replace( /./g, ' ' )} max: ${n.max.toString()}`
    ] ).join( '\n' ) );

    console.log( 'chunkReduces0' );
    console.log( chunkReduces0.data.slice( 0, 4 * Math.ceil( numInputEdges / workgroupSize ) ).map( toIndexedString ).join( '\n' ) );

    const chunkReduces1 = new ParallelStorageArray( _.range( 0, 1024 ).map( () => RasterChunkReduceData.INDETERMINATE ), RasterChunkReduceData.INDETERMINATE );
    await ParallelRasterChunkReduce.dispatch( workgroupSize, clippedChunks, chunkReduces0, Math.ceil( numInputEdges / workgroupSize ), chunkReduces1 );

    console.log( 'chunkReduces1' );
    console.log( chunkReduces1.data.slice( 0, 4 * Math.ceil( numInputEdges / ( workgroupSize * workgroupSize ) ) ).map( toIndexedString ).join( '\n' ) );

    const chunkReduces2 = new ParallelStorageArray( _.range( 0, 1024 ).map( () => RasterChunkReduceData.INDETERMINATE ), RasterChunkReduceData.INDETERMINATE );
    await ParallelRasterChunkReduce.dispatch( workgroupSize, clippedChunks, chunkReduces1, Math.ceil( numInputEdges / ( workgroupSize * workgroupSize ) ), chunkReduces2 );

    console.log( 'chunkReduces2' );
    console.log( chunkReduces2.data.slice( 0, 4 * Math.ceil( numInputEdges / ( workgroupSize * workgroupSize * workgroupSize ) ) ).map( toIndexedString ).join( '\n' ) );

    console.log( 'clippedChunks (with reduce)' );
    console.log( clippedChunks.data.slice( 0, numInputChunks * 2 ).map( chunk => chunk.toString() ).join( '\n' ) );

    // TODO: the rest of the processing
  }
}

alpenglow.register( 'ParallelRaster', ParallelRaster );
