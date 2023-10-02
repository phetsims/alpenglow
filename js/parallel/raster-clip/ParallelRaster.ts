// Copyright 2023, University of Colorado Boulder

/**
 * Rasterization prototype for WebGPU, but using the parallel (debuggable) API.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, ParallelRasterChunkReduce, ParallelRasterEdgeReduce, ParallelRasterEdgeScan, ParallelRasterChunkIndexPatch, ParallelRasterInitialChunk, ParallelRasterInitialClip, ParallelRasterInitialEdgeReduce, ParallelRasterInitialSplitReduce, ParallelRasterSplitScan, ParallelStorageArray, RasterChunk, RasterChunkReduceBlock, RasterChunkReduceData, RasterClippedChunk, RasterEdge, RasterEdgeClip, RasterSplitReduceData, ParallelRasterEdgeIndexPatch, RasterCompleteChunk, RasterCompleteEdge } from '../../imports.js';
import Vector2 from '../../../../dot/js/Vector2.js';

// TODO: change back to 256 once we are done testing
const WORKGROUP_SIZE = 4;

export default class ParallelRaster {
  public static async test(): Promise<void> {
    const rawInputChunks = [
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
    ];

    const rawInputEdges = [
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
    ];

    const numInputChunks = rawInputChunks.length;
    const numInputEdges = rawInputEdges.length;

    const inputChunks = new ParallelStorageArray( rawInputChunks, RasterChunk.INDETERMINATE );
    const inputEdges = new ParallelStorageArray( rawInputEdges, RasterEdge.INDETERMINATE );

    assert && RasterChunk.validate( inputChunks, inputEdges, numInputChunks, numInputEdges );

    await ParallelRaster.process( WORKGROUP_SIZE, numInputChunks, numInputEdges, inputChunks, inputEdges );
  }

  public static async process(
    workgroupSize: number,
    numInputChunks: number,
    numInputEdges: number,

    // input
    inputChunks: ParallelStorageArray<RasterChunk>,
    inputEdges: ParallelStorageArray<RasterEdge>
  ): Promise<{
    reducibleChunks: ParallelStorageArray<RasterChunk>;
    reducibleEdges: ParallelStorageArray<RasterEdge>;
    numReducibleChunks: number;
    numReducibleEdges: number;

    completeChunks: ParallelStorageArray<RasterCompleteChunk>;
    completeEdges: ParallelStorageArray<RasterCompleteEdge>;
    numCompleteChunks: number;
    numCompleteEdges: number;
  }> {
    assert && RasterChunk.validate( inputChunks, inputEdges, numInputChunks, numInputEdges );

    // For now, we have a binary split
    const numClippedChunks = 2 * numInputChunks;
    const numEdgeClips = 2 * numInputEdges;

    const toIndexedString = ( n: { toString(): string }, i: number ) => `${i} ${n.toString()}`;

    console.log( `numInputChunks: ${numInputChunks}` );
    console.log( inputChunks.data.slice( 0, numInputChunks ).map( toIndexedString ).join( '\n' ) );

    console.log( `numInputEdges: ${numInputEdges}` );
    console.log( inputEdges.data.slice( 0, numInputEdges ).map( toIndexedString ).join( '\n' ) );

    const clippedChunks = new ParallelStorageArray( _.range( 0, 4096 ).map( () => RasterClippedChunk.INDETERMINATE ), RasterClippedChunk.INDETERMINATE );

    console.log( 'ParallelRasterInitialChunk dispatch' );
    await ParallelRasterInitialChunk.dispatch(
      workgroupSize,
      inputChunks,
      numInputChunks,
      clippedChunks
    );

    console.log( 'clippedChunks (without reduce)' );
    console.log( clippedChunks.data.slice( 0, numClippedChunks ).map( toIndexedString ).join( '\n' ) );

    const edgeClips = new ParallelStorageArray( _.range( 0, 1024 ).map( () => RasterEdgeClip.INDETERMINATE ), RasterEdgeClip.INDETERMINATE );
    const chunkReduces0 = new ParallelStorageArray( _.range( 0, 4096 ).map( () => RasterChunkReduceBlock.INDETERMINATE ), RasterChunkReduceBlock.INDETERMINATE );
    const debugFullChunkReduces = new ParallelStorageArray( _.range( 0, 4096 ).map( () => ( { min: RasterChunkReduceData.INDETERMINATE, max: RasterChunkReduceData.INDETERMINATE } ) ), { min: RasterChunkReduceData.INDETERMINATE, max: RasterChunkReduceData.INDETERMINATE } );

    console.log( 'ParallelRasterInitialClip dispatch' );
    await ParallelRasterInitialClip.dispatch(
      workgroupSize,
      inputChunks, inputEdges,
      numInputEdges,
      clippedChunks,
      edgeClips, chunkReduces0, debugFullChunkReduces
    );

    console.log( 'edgeClips' );
    console.log( edgeClips.data.slice( 0, numEdgeClips ).map( toIndexedString ).join( '\n' ) );

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

    console.log( 'ParallelRasterChunkReduce dispatch' );
    await ParallelRasterChunkReduce.dispatch(
      workgroupSize,
      chunkReduces0,
      Math.ceil( numInputEdges / workgroupSize ),
      clippedChunks,
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

    console.log( 'ParallelRasterChunkReduce dispatch' );
    await ParallelRasterChunkReduce.dispatch(
      workgroupSize,
      chunkReduces1,
      Math.ceil( numInputEdges / ( workgroupSize * workgroupSize ) ),
      clippedChunks,
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
    console.log( clippedChunks.data.slice( 0, numClippedChunks ).map( chunk => chunk.toString() ).join( '\n' ) );

    /*
     * "split" reduce/scan, to distribute the chunks into reducibleChunks/completeChunks
     */

    const debugFullSplitReduces = new ParallelStorageArray( _.range( 0, 4096 ).map( () => RasterSplitReduceData.INDETERMINATE ), RasterSplitReduceData.INDETERMINATE );
    const splitReduces0 = new ParallelStorageArray( _.range( 0, 4096 ).map( () => RasterSplitReduceData.INDETERMINATE ), RasterSplitReduceData.INDETERMINATE );

    console.log( 'ParallelRasterInitialSplitReduce dispatch' );
    await ParallelRasterInitialSplitReduce.dispatch(
      workgroupSize,
      clippedChunks,
      numClippedChunks,
      debugFullSplitReduces, splitReduces0
    );

    console.log( 'debugFullSplitReduces' );
    console.log( debugFullSplitReduces.data.slice( 0, numClippedChunks ).map( toIndexedString ).join( '\n' ) );

    console.log( 'splitReduces0 (reduced)' );
    console.log( splitReduces0.data.slice( 0, Math.ceil( numClippedChunks / workgroupSize ) ).map( toIndexedString ).join( '\n' ) );

    const splitReduces1 = new ParallelStorageArray( _.range( 0, 1024 ).map( () => RasterSplitReduceData.INDETERMINATE ), RasterSplitReduceData.INDETERMINATE );

    console.log( 'ParallelRasterEdgeReduce dispatch' );
    await ParallelRasterEdgeReduce.dispatch(
      workgroupSize,
      Math.ceil( numClippedChunks / workgroupSize ),
      splitReduces0,
      splitReduces1
    );

    console.log( 'splitReduces0 (scanned)' );
    console.log( splitReduces0.data.slice( 0, Math.ceil( numClippedChunks / workgroupSize ) ).map( toIndexedString ).join( '\n' ) );

    console.log( 'splitReduces1 (reduced)' );
    console.log( splitReduces1.data.slice( 0, Math.ceil( numClippedChunks / ( workgroupSize * workgroupSize ) ) ).map( toIndexedString ).join( '\n' ) );

    const splitReduces2 = new ParallelStorageArray( _.range( 0, 1024 ).map( () => RasterSplitReduceData.INDETERMINATE ), RasterSplitReduceData.INDETERMINATE );

    console.log( 'ParallelRasterEdgeReduce dispatch' );
    await ParallelRasterEdgeReduce.dispatch(
      workgroupSize,
      Math.ceil( numClippedChunks / ( workgroupSize * workgroupSize ) ),
      splitReduces1,
      splitReduces2
    );

    console.log( 'splitReduces1 (scanned)' );
    console.log( splitReduces1.data.slice( 0, Math.ceil( numClippedChunks / ( workgroupSize * workgroupSize ) ) ).map( toIndexedString ).join( '\n' ) );

    console.log( 'splitReduces2 (reduced)' );
    console.log( splitReduces2.data.slice( 0, Math.ceil( numClippedChunks / ( workgroupSize * workgroupSize * workgroupSize ) ) ).map( toIndexedString ).join( '\n' ) );

    assert && assert( Math.ceil( numClippedChunks / ( workgroupSize * workgroupSize * workgroupSize ) ) === 1 );

    const reducibleChunkCount = splitReduces2.data[ 0 ].numReducible;
    const completeChunkCount = splitReduces2.data[ 0 ].numComplete;

    const reducibleChunks = new ParallelStorageArray( _.range( 0, 4096 ).map( () => RasterChunk.INDETERMINATE ), RasterChunk.INDETERMINATE );
    const completeChunks = new ParallelStorageArray( _.range( 0, 4096 ).map( () => RasterCompleteChunk.INDETERMINATE ), RasterCompleteChunk.INDETERMINATE );
    const chunkIndexMap = new ParallelStorageArray( _.range( 0, 4096 ).map( () => NaN ), NaN );

    console.log( 'ParallelRasterSplitScan dispatch' );
    await ParallelRasterSplitScan.dispatch(
      workgroupSize,
      clippedChunks, splitReduces0, splitReduces1, splitReduces2,
      numClippedChunks,
      reducibleChunks, completeChunks, chunkIndexMap
    );

    console.log( `reducibleChunks ${reducibleChunkCount}` );
    console.log( reducibleChunks.data.slice( 0, reducibleChunkCount ).map( toIndexedString ).join( '\n' ) );

    console.log( `completeChunks ${completeChunkCount}` );
    console.log( completeChunks.data.slice( 0, completeChunkCount ).map( toIndexedString ).join( '\n' ) );

    console.log( 'chunkIndexMap' );
    console.log( chunkIndexMap.data.slice( 0, numClippedChunks ).map( toIndexedString ).join( '\n' ) );

    /*
     * "edge" reduce/scan, to distribute the edges into reducibleEdges/completeEdges
     */

    const debugFullEdgeReduces = new ParallelStorageArray( _.range( 0, 4096 ).map( () => RasterSplitReduceData.INDETERMINATE ), RasterSplitReduceData.INDETERMINATE );
    const edgeReduces0 = new ParallelStorageArray( _.range( 0, 4096 ).map( () => RasterSplitReduceData.INDETERMINATE ), RasterSplitReduceData.INDETERMINATE );

    console.log( 'ParallelRasterInitialEdgeReduce dispatch' );
    await ParallelRasterInitialEdgeReduce.dispatch(
      workgroupSize,
      clippedChunks, edgeClips,
      numEdgeClips,
      debugFullEdgeReduces, edgeReduces0
    );

    console.log( 'debugFullEdgeReduces' );
    console.log( debugFullEdgeReduces.data.slice( 0, numEdgeClips ).map( toIndexedString ).join( '\n' ) );

    console.log( 'edgeReduces0 (reduced)' );
    console.log( edgeReduces0.data.slice( 0, Math.ceil( numEdgeClips / workgroupSize ) ).map( toIndexedString ).join( '\n' ) );

    const edgeReduces1 = new ParallelStorageArray( _.range( 0, 1024 ).map( () => RasterSplitReduceData.INDETERMINATE ), RasterSplitReduceData.INDETERMINATE );

    console.log( 'ParallelRasterEdgeReduce dispatch' );
    await ParallelRasterEdgeReduce.dispatch(
      workgroupSize,
      Math.ceil( numEdgeClips / workgroupSize ),
      edgeReduces0,
      edgeReduces1
    );

    console.log( 'edgeReduces0 (scanned)' );
    console.log( edgeReduces0.data.slice( 0, Math.ceil( numEdgeClips / workgroupSize ) ).map( toIndexedString ).join( '\n' ) );

    console.log( 'edgeReduces1 (reduced)' );
    console.log( edgeReduces1.data.slice( 0, Math.ceil( numEdgeClips / ( workgroupSize * workgroupSize ) ) ).map( toIndexedString ).join( '\n' ) );

    const edgeReduces2 = new ParallelStorageArray( _.range( 0, 1024 ).map( () => RasterSplitReduceData.INDETERMINATE ), RasterSplitReduceData.INDETERMINATE );

    console.log( 'ParallelRasterEdgeReduce dispatch' );
    await ParallelRasterEdgeReduce.dispatch(
      workgroupSize,
      Math.ceil( numEdgeClips / ( workgroupSize * workgroupSize ) ),
      edgeReduces1,
      edgeReduces2
    );

    console.log( 'edgeReduces1 (scanned)' );
    console.log( edgeReduces1.data.slice( 0, Math.ceil( numEdgeClips / ( workgroupSize * workgroupSize ) ) ).map( toIndexedString ).join( '\n' ) );

    console.log( 'edgeReduces2 (reduced)' );
    console.log( edgeReduces2.data.slice( 0, Math.ceil( numEdgeClips / ( workgroupSize * workgroupSize * workgroupSize ) ) ).map( toIndexedString ).join( '\n' ) );

    assert && assert( Math.ceil( numEdgeClips / ( workgroupSize * workgroupSize * workgroupSize ) ) === 1 );

    const reducibleEdgeCount = edgeReduces2.data[ 0 ].numReducible;
    const completeEdgeCount = edgeReduces2.data[ 0 ].numComplete;

    const reducibleEdges = new ParallelStorageArray( _.range( 0, 4096 ).map( () => RasterEdge.INDETERMINATE ), RasterEdge.INDETERMINATE );
    const completeEdges = new ParallelStorageArray( _.range( 0, 4096 ).map( () => RasterCompleteEdge.INDETERMINATE ), RasterCompleteEdge.INDETERMINATE );
    const chunkIndices = new ParallelStorageArray( _.range( 0, 4096 ).map( () => NaN ), NaN );

    console.log( 'ParallelRasterEdgeScan dispatch' );
    await ParallelRasterEdgeScan.dispatch(
      workgroupSize,
      clippedChunks, edgeClips, edgeReduces0, edgeReduces1, edgeReduces2,
      numInputEdges,
      reducibleEdges, completeEdges, chunkIndices
    );

    console.log( `reducibleEdges ${reducibleEdgeCount}` );
    console.log( reducibleEdges.data.slice( 0, reducibleEdgeCount ).map( toIndexedString ).join( '\n' ) );

    console.log( `completeEdges ${completeEdgeCount}` );
    console.log( completeEdges.data.slice( 0, completeEdgeCount ).map( toIndexedString ).join( '\n' ) );

    console.log( 'chunkIndices' );
    // each has a min/max!
    console.log( chunkIndices.data.slice( 0, numClippedChunks * 2 ).map( toIndexedString ).join( '\n' ) );

    console.log( 'ParallelRasterChunkIndexPatch dispatch' );
    await ParallelRasterChunkIndexPatch.dispatch(
      workgroupSize,
      chunkIndexMap, chunkIndices, clippedChunks,
      numClippedChunks,
      reducibleChunks, completeChunks
    );

    console.log( `reducibleChunks ${reducibleChunkCount}` );
    console.log( reducibleChunks.data.slice( 0, reducibleChunkCount ).map( toIndexedString ).join( '\n' ) );

    console.log( `completeChunks ${completeChunkCount}` );
    console.log( completeChunks.data.slice( 0, completeChunkCount ).map( toIndexedString ).join( '\n' ) );

    console.log( 'ParallelRasterEdgeIndexPatch dispatch' );
    await ParallelRasterEdgeIndexPatch.dispatch(
      workgroupSize,
      chunkIndexMap, chunkIndices,
      reducibleEdgeCount,
      reducibleEdges
    );

    console.log( `reducibleEdges ${reducibleEdgeCount}` );
    console.log( reducibleEdges.data.slice( 0, reducibleEdgeCount ).map( toIndexedString ).join( '\n' ) );

    console.log( `completeEdges ${completeEdgeCount}` );
    console.log( completeEdges.data.slice( 0, completeEdgeCount ).map( toIndexedString ).join( '\n' ) );

    assert && RasterChunk.validate( reducibleChunks, reducibleEdges, reducibleChunkCount, reducibleEdgeCount );
    assert && RasterCompleteChunk.validate( completeChunks, completeEdges, completeChunkCount, completeEdgeCount );

    return {
      reducibleChunks: reducibleChunks,
      reducibleEdges: reducibleEdges,
      numReducibleChunks: reducibleChunkCount,
      numReducibleEdges: reducibleEdgeCount,

      completeChunks: completeChunks,
      completeEdges: completeEdges,
      numCompleteChunks: completeChunkCount,
      numCompleteEdges: completeEdgeCount
    };
  }
}

alpenglow.register( 'ParallelRaster', ParallelRaster );
