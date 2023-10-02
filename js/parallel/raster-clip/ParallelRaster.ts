// Copyright 2023, University of Colorado Boulder

/**
 * Rasterization prototype for WebGPU, but using the parallel (debuggable) API.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, ParallelRasterChunkReduce, ParallelRasterEdgeReduce, ParallelRasterEdgeScan, ParallelRasterChunkIndexPatch, ParallelRasterInitialChunk, ParallelRasterInitialClip, ParallelRasterInitialEdgeReduce, ParallelRasterInitialSplitReduce, ParallelRasterSplitScan, ParallelStorageArray, RasterChunk, RasterChunkReduceBlock, RasterChunkReduceData, RasterClippedChunk, RasterEdge, RasterEdgeClip, RasterSplitReduceData, ParallelRasterEdgeIndexPatch, RasterCompleteChunk, RasterCompleteEdge } from '../../imports.js';
import Vector2 from '../../../../dot/js/Vector2.js';

export default class ParallelRaster {
  public static async test(): Promise<void> {
    const inputChunks = new ParallelStorageArray( [
      new RasterChunk(
        0,
        false,
        0,
        5,
        0, 0, 10, 10,
        -1, 1, 0, 0
      ),
      new RasterChunk(
        1,
        false,
        5,
        3,
        10, 0, 20, 10,
        0, 1, 0, 0
      ),
      new RasterChunk(
        2,
        true,
        8,
        1,
        9, 8, 10, 10,
        -1, 1, 0, 0
      ),
      new RasterChunk(
        3,
        true,
        9,
        4,
        7, 9, 9, 10,
        0, 0, 0, 0
      ),
      new RasterChunk(
        4,
        true,
        13,
        6,
        10, 5, 20, 10,
        0, 0, 0, 0
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
      ),
      new RasterEdge(
        2,
        true,
        true,
        new Vector2( 10, 8 ),
        new Vector2( 9, 10 )
      ),
      new RasterEdge(
        3,
        true,
        false,
        new Vector2( 7.5, 9 ),
        new Vector2( 9, 9 )
      ),
      new RasterEdge(
        3,
        false,
        false,
        new Vector2( 9, 9 ),
        new Vector2( 9, 10 )
      ),
      new RasterEdge(
        3,
        false,
        false,
        new Vector2( 9, 10 ),
        new Vector2( 7.5, 10 )
      ),
      new RasterEdge(
        3,
        false,
        true,
        new Vector2( 7.5, 10 ),
        new Vector2( 7.5, 9 )
      ),
      new RasterEdge(
        4,
        true,
        false,
        new Vector2( 10, 9 ),
        new Vector2( 11, 9 )
      ),
      new RasterEdge(
        4,
        false,
        false,
        new Vector2( 11, 9 ),
        new Vector2( 10, 10 )
      ),
      new RasterEdge(
        4,
        false,
        false,
        new Vector2( 10, 10 ),
        new Vector2( 10, 9 )
      ),
      new RasterEdge(
        4,
        false,
        false,
        new Vector2( 19, 9 ),
        new Vector2( 20, 9 )
      ),
      new RasterEdge(
        4,
        false,
        false,
        new Vector2( 20, 9 ),
        new Vector2( 19, 10 )
      ),
      new RasterEdge(
        4,
        false,
        true,
        new Vector2( 19, 10 ),
        new Vector2( 19, 9 )
      )
    ], RasterEdge.INDETERMINATE );

    // TODO: scan this to see if we've got first/last edges correct, counts correct, etc.

    const outputChunks = new ParallelStorageArray( _.range( 0, 1024 ).map( () => RasterChunk.INDETERMINATE ), RasterChunk.INDETERMINATE );
    const outputEdges = new ParallelStorageArray( _.range( 0, 4096 ).map( () => RasterEdge.INDETERMINATE ), RasterEdge.INDETERMINATE );

    // TODO: change back to 256 once we are done testing
    await ParallelRaster.process( 4, inputChunks.data.length, inputEdges.data.length, inputChunks, inputEdges, outputChunks, outputEdges );
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
    await ParallelRasterInitialChunk.dispatch(
      workgroupSize,
      inputChunks,
      numInputChunks,
      clippedChunks
    );

    console.log( 'clippedChunks (without reduce)' );
    console.log( clippedChunks.data.slice( 0, numInputChunks * 2 ).map( toIndexedString ).join( '\n' ) );

    const edgeClips = new ParallelStorageArray( _.range( 0, 1024 ).map( () => RasterEdgeClip.INDETERMINATE ), RasterEdgeClip.INDETERMINATE );
    const chunkReduces0 = new ParallelStorageArray( _.range( 0, 4096 ).map( () => RasterChunkReduceBlock.INDETERMINATE ), RasterChunkReduceBlock.INDETERMINATE );
    const debugFullChunkReduces = new ParallelStorageArray( _.range( 0, 4096 ).map( () => ( { min: RasterChunkReduceData.INDETERMINATE, max: RasterChunkReduceData.INDETERMINATE } ) ), { min: RasterChunkReduceData.INDETERMINATE, max: RasterChunkReduceData.INDETERMINATE } );
    await ParallelRasterInitialClip.dispatch(
      workgroupSize,
      inputChunks, inputEdges, clippedChunks,
      numInputEdges,
      edgeClips, chunkReduces0, debugFullChunkReduces
    );

    console.log( 'edgeClips' );
    console.log( edgeClips.data.slice( 0, numInputEdges * 2 ).map( toIndexedString ).join( '\n' ) );

    console.log( 'debugFullChunkReduces' );
    console.log( debugFullChunkReduces.data.slice( 0, numInputEdges ).flatMap( ( n, i ) => [
      `${i} min: ${n.min.toString()}`,
      `${i.toString().replace( /./g, ' ' )} max: ${n.max.toString()}`
    ] ).join( '\n' ) );

    console.log( 'chunkReduces0' );
    console.log( chunkReduces0.data.slice( 0, Math.ceil( numInputEdges / workgroupSize ) ).flatMap( ( n, i ) => [
      `${i} leftMin: ${n.leftMin.toString()}`,
      `${i.toString().replace( /./g, ' ' )} rightMin: ${n.rightMin.toString()}`,
      `${i.toString().replace( /./g, ' ' )} leftMax: ${n.leftMax.toString()}`,
      `${i.toString().replace( /./g, ' ' )} rightMax: ${n.rightMax.toString()}`
    ] ).join( '\n' ) );

    const chunkReduces1 = new ParallelStorageArray( _.range( 0, 1024 ).map( () => RasterChunkReduceBlock.INDETERMINATE ), RasterChunkReduceBlock.INDETERMINATE );
    await ParallelRasterChunkReduce.dispatch(
      workgroupSize,
      clippedChunks, chunkReduces0,
      Math.ceil( numInputEdges / workgroupSize ),
      chunkReduces1
    );

    console.log( 'chunkReduces1' );
    console.log( chunkReduces1.data.slice( 0, Math.ceil( numInputEdges / ( workgroupSize * workgroupSize ) ) ).flatMap( ( n, i ) => [
      `${i} leftMin: ${n.leftMin.toString()}`,
      `${i.toString().replace( /./g, ' ' )} rightMin: ${n.rightMin.toString()}`,
      `${i.toString().replace( /./g, ' ' )} leftMax: ${n.leftMax.toString()}`,
      `${i.toString().replace( /./g, ' ' )} rightMax: ${n.rightMax.toString()}`
    ] ).join( '\n' ) );

    const chunkReduces2 = new ParallelStorageArray( _.range( 0, 1024 ).map( () => RasterChunkReduceBlock.INDETERMINATE ), RasterChunkReduceBlock.INDETERMINATE );
    await ParallelRasterChunkReduce.dispatch(
      workgroupSize,
      clippedChunks, chunkReduces1,
      Math.ceil( numInputEdges / ( workgroupSize * workgroupSize ) ),
      chunkReduces2
    );

    console.log( 'chunkReduces2' );
    console.log( chunkReduces2.data.slice( 0, Math.ceil( numInputEdges / ( workgroupSize * workgroupSize * workgroupSize ) ) ).flatMap( ( n, i ) => [
      `${i} leftMin: ${n.leftMin.toString()}`,
      `${i.toString().replace( /./g, ' ' )} rightMin: ${n.rightMin.toString()}`,
      `${i.toString().replace( /./g, ' ' )} leftMax: ${n.leftMax.toString()}`,
      `${i.toString().replace( /./g, ' ' )} rightMax: ${n.rightMax.toString()}`
    ] ).join( '\n' ) );

    console.log( 'clippedChunks (with reduce)' );
    console.log( clippedChunks.data.slice( 0, numInputChunks * 2 ).map( chunk => chunk.toString() ).join( '\n' ) );

    /*
     * "split" reduce/scan, to distribute the chunks into reducibleChunks/completeChunks
     */

    const debugFullSplitReduces = new ParallelStorageArray( _.range( 0, 4096 ).map( () => RasterSplitReduceData.INDETERMINATE ), RasterSplitReduceData.INDETERMINATE );
    const splitReduces0 = new ParallelStorageArray( _.range( 0, 4096 ).map( () => RasterSplitReduceData.INDETERMINATE ), RasterSplitReduceData.INDETERMINATE );

    await ParallelRasterInitialSplitReduce.dispatch(
      workgroupSize,
      clippedChunks,
      numInputChunks * 2,
      debugFullSplitReduces, splitReduces0
    );

    console.log( 'debugFullSplitReduces' );
    console.log( debugFullSplitReduces.data.slice( 0, numInputChunks * 2 ).map( toIndexedString ).join( '\n' ) );

    console.log( 'splitReduces0 (reduced)' );
    console.log( splitReduces0.data.slice( 0, Math.ceil( numInputChunks * 2 / workgroupSize ) ).map( toIndexedString ).join( '\n' ) );

    const splitReduces1 = new ParallelStorageArray( _.range( 0, 1024 ).map( () => RasterSplitReduceData.INDETERMINATE ), RasterSplitReduceData.INDETERMINATE );

    await ParallelRasterEdgeReduce.dispatch(
      workgroupSize,
      splitReduces0,
      Math.ceil( numInputChunks * 2 / workgroupSize ),
      splitReduces1
    );

    console.log( 'splitReduces0 (scanned)' );
    console.log( splitReduces0.data.slice( 0, Math.ceil( numInputChunks * 2 / workgroupSize ) ).map( toIndexedString ).join( '\n' ) );

    console.log( 'splitReduces1 (reduced)' );
    console.log( splitReduces1.data.slice( 0, Math.ceil( numInputChunks * 2 / ( workgroupSize * workgroupSize ) ) ).map( toIndexedString ).join( '\n' ) );

    const splitReduces2 = new ParallelStorageArray( _.range( 0, 1024 ).map( () => RasterSplitReduceData.INDETERMINATE ), RasterSplitReduceData.INDETERMINATE );

    await ParallelRasterEdgeReduce.dispatch(
      workgroupSize,
      splitReduces1,
      Math.ceil( numInputChunks * 2 / ( workgroupSize * workgroupSize ) ),
      splitReduces2
    );

    console.log( 'splitReduces1 (scanned)' );
    console.log( splitReduces1.data.slice( 0, Math.ceil( numInputChunks * 2 / ( workgroupSize * workgroupSize ) ) ).map( toIndexedString ).join( '\n' ) );

    console.log( 'splitReduces2 (reduced)' );
    console.log( splitReduces2.data.slice( 0, Math.ceil( numInputChunks * 2 / ( workgroupSize * workgroupSize * workgroupSize ) ) ).map( toIndexedString ).join( '\n' ) );

    assert && assert( Math.ceil( numInputChunks * 2 / ( workgroupSize * workgroupSize * workgroupSize ) ) === 1 );

    const reducibleChunkCount = splitReduces2.data[ 0 ].numReducible;
    const completeChunkCount = splitReduces2.data[ 0 ].numComplete;

    const reducibleChunks = new ParallelStorageArray( _.range( 0, 4096 ).map( () => RasterChunk.INDETERMINATE ), RasterChunk.INDETERMINATE );
    const completeChunks = new ParallelStorageArray( _.range( 0, 4096 ).map( () => RasterCompleteChunk.INDETERMINATE ), RasterCompleteChunk.INDETERMINATE );
    const chunkIndexMap = new ParallelStorageArray( _.range( 0, 4096 ).map( () => NaN ), NaN );

    await ParallelRasterSplitScan.dispatch(
      workgroupSize,
      clippedChunks, splitReduces0, splitReduces1, splitReduces2,
      numInputChunks * 2,
      reducibleChunks, completeChunks, chunkIndexMap
    );

    console.log( `reducibleChunks ${reducibleChunkCount}` );
    console.log( reducibleChunks.data.slice( 0, reducibleChunkCount ).map( toIndexedString ).join( '\n' ) );

    console.log( `completeChunks ${completeChunkCount}` );
    console.log( completeChunks.data.slice( 0, completeChunkCount ).map( toIndexedString ).join( '\n' ) );

    console.log( 'chunkIndexMap' );
    console.log( chunkIndexMap.data.slice( 0, numInputChunks * 2 ).map( toIndexedString ).join( '\n' ) );

    /*
     * "edge" reduce/scan, to distribute the edges into reducibleEdges/completeEdges
     */

    const debugFullEdgeReduces = new ParallelStorageArray( _.range( 0, 4096 ).map( () => RasterSplitReduceData.INDETERMINATE ), RasterSplitReduceData.INDETERMINATE );
    const edgeReduces0 = new ParallelStorageArray( _.range( 0, 4096 ).map( () => RasterSplitReduceData.INDETERMINATE ), RasterSplitReduceData.INDETERMINATE );

    await ParallelRasterInitialEdgeReduce.dispatch(
      workgroupSize,
      clippedChunks, edgeClips,
      numInputEdges, numInputChunks,
      debugFullEdgeReduces, edgeReduces0
    );

    console.log( 'debugFullEdgeReduces' );
    console.log( debugFullEdgeReduces.data.slice( 0, numInputEdges * 2 ).map( toIndexedString ).join( '\n' ) );

    console.log( 'edgeReduces0 (reduced)' );
    console.log( edgeReduces0.data.slice( 0, Math.ceil( numInputEdges * 2 / workgroupSize ) ).map( toIndexedString ).join( '\n' ) );

    const edgeReduces1 = new ParallelStorageArray( _.range( 0, 1024 ).map( () => RasterSplitReduceData.INDETERMINATE ), RasterSplitReduceData.INDETERMINATE );

    await ParallelRasterEdgeReduce.dispatch(
      workgroupSize,
      edgeReduces0,
      Math.ceil( numInputEdges * 2 / workgroupSize ),
      edgeReduces1
    );

    console.log( 'edgeReduces0 (scanned)' );
    console.log( edgeReduces0.data.slice( 0, Math.ceil( numInputEdges * 2 / workgroupSize ) ).map( toIndexedString ).join( '\n' ) );

    console.log( 'edgeReduces1 (reduced)' );
    console.log( edgeReduces1.data.slice( 0, Math.ceil( numInputEdges * 2 / ( workgroupSize * workgroupSize ) ) ).map( toIndexedString ).join( '\n' ) );

    const edgeReduces2 = new ParallelStorageArray( _.range( 0, 1024 ).map( () => RasterSplitReduceData.INDETERMINATE ), RasterSplitReduceData.INDETERMINATE );

    // TODO: add assertion that we've reduced it to a small enough number of values

    await ParallelRasterEdgeReduce.dispatch(
      workgroupSize,
      edgeReduces1,
      Math.ceil( numInputEdges * 2 / ( workgroupSize * workgroupSize ) ),
      edgeReduces2
    );

    console.log( 'edgeReduces1 (scanned)' );
    console.log( edgeReduces1.data.slice( 0, Math.ceil( numInputEdges * 2 / ( workgroupSize * workgroupSize ) ) ).map( toIndexedString ).join( '\n' ) );

    console.log( 'edgeReduces2 (reduced)' );
    console.log( edgeReduces2.data.slice( 0, Math.ceil( numInputEdges * 2 / ( workgroupSize * workgroupSize * workgroupSize ) ) ).map( toIndexedString ).join( '\n' ) );

    assert && assert( Math.ceil( numInputEdges * 2 / ( workgroupSize * workgroupSize * workgroupSize ) ) === 1 );

    const reducibleEdgeCount = edgeReduces2.data[ 0 ].numReducible;
    const completeEdgeCount = edgeReduces2.data[ 0 ].numComplete;

    const reducibleEdges = new ParallelStorageArray( _.range( 0, 4096 ).map( () => RasterEdge.INDETERMINATE ), RasterEdge.INDETERMINATE );
    const completeEdges = new ParallelStorageArray( _.range( 0, 4096 ).map( () => RasterCompleteEdge.INDETERMINATE ), RasterCompleteEdge.INDETERMINATE );
    const chunkIndices = new ParallelStorageArray( _.range( 0, 4096 ).map( () => NaN ), NaN );

    await ParallelRasterEdgeScan.dispatch(
      workgroupSize,
      clippedChunks, edgeClips, edgeReduces0, edgeReduces1, edgeReduces2,
      numInputEdges, numInputChunks,
      reducibleEdges, completeEdges, chunkIndices
    );

    console.log( `reducibleEdges ${reducibleEdgeCount}` );
    console.log( reducibleEdges.data.slice( 0, reducibleEdgeCount ).map( toIndexedString ).join( '\n' ) );

    console.log( `completeEdges ${completeEdgeCount}` );
    console.log( completeEdges.data.slice( 0, completeEdgeCount ).map( toIndexedString ).join( '\n' ) );

    console.log( 'chunkIndices' );
    // we go to 2x chunks, each has min/max
    console.log( chunkIndices.data.slice( 0, numInputChunks * 2 * 2 ).map( toIndexedString ).join( '\n' ) );

    await ParallelRasterChunkIndexPatch.dispatch(
      workgroupSize,
      chunkIndexMap, chunkIndices, reducibleChunks, completeChunks, clippedChunks,
      numInputChunks * 2
    );

    console.log( `reducibleChunks ${reducibleChunkCount}` );
    console.log( reducibleChunks.data.slice( 0, reducibleChunkCount ).map( toIndexedString ).join( '\n' ) );

    console.log( `completeChunks ${completeChunkCount}` );
    console.log( completeChunks.data.slice( 0, completeChunkCount ).map( toIndexedString ).join( '\n' ) );

    await ParallelRasterEdgeIndexPatch.dispatch(
      workgroupSize,
      chunkIndexMap, chunkIndices, reducibleEdges, reducibleEdgeCount
    );

    console.log( `reducibleEdges ${reducibleEdgeCount}` );
    console.log( reducibleEdges.data.slice( 0, reducibleEdgeCount ).map( toIndexedString ).join( '\n' ) );

    console.log( `completeEdges ${completeEdgeCount}` );
    console.log( completeEdges.data.slice( 0, completeEdgeCount ).map( toIndexedString ).join( '\n' ) );
  }
}

alpenglow.register( 'ParallelRaster', ParallelRaster );
