// Copyright 2023, University of Colorado Boulder

/**
 * Rasterization prototype for WebGPU, but using the parallel (debuggable) API.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, ByteEncoder, CombinedRaster, ParallelRasterChunkIndexPatch, ParallelRasterChunkReduce, ParallelRasterEdgeIndexPatch, ParallelRasterEdgeReduce, ParallelRasterEdgeScan, ParallelRasterInitialChunk, ParallelRasterInitialClip, ParallelRasterInitialEdgeReduce, ParallelRasterInitialSplitReduce, ParallelRasterSplitScan, ParallelStorageArray, RasterChunk, RasterChunkReduceBlock, RasterChunkReduceData, RasterClippedChunk, RasterCompleteChunk, RasterCompleteEdge, RasterEdge, RasterEdgeClip, RasterSplitReduceData, TestToCanvas } from '../../imports.js';
import Vector4 from '../../../../dot/js/Vector4.js';

// TODO: change back to 256 once we are done testing
const WORKGROUP_SIZE = 256;
const LOG = false;

export default class ParallelRaster {
  public static async test(): Promise<void> {

    // const rawInputChunks = [
    //   new RasterChunk(
    //     0,
    //     false,
    //     0,
    //     5,
    //     0, 0, 10, 10,
    //     -1, 1, 0, 0
    //   ),
    //   new RasterChunk(
    //     1,
    //     false,
    //     5,
    //     3,
    //     10, 0, 20, 10,
    //     0, 1, 0, 0
    //   ),
    //   new RasterChunk(
    //     2,
    //     true,
    //     8,
    //     1,
    //     9, 8, 10, 10,
    //     -1, 1, 0, 0
    //   ),
    //   new RasterChunk(
    //     3,
    //     true,
    //     9,
    //     4,
    //     7, 9, 9, 10,
    //     0, 0, 0, 0
    //   ),
    //   new RasterChunk(
    //     4,
    //     true,
    //     13,
    //     6,
    //     10, 5, 20, 10,
    //     0, 0, 0, 0
    //   ),
    //   new RasterChunk(
    //     5,
    //     true,
    //     19,
    //     1,
    //     19, 3, 20, 4,
    //     -1, 1, 0, 0
    //   ),
    //   new RasterChunk(
    //     6,
    //     false,
    //     20,
    //     0,
    //     11, 8, 12, 9,
    //     -1, 1, 1, -1
    //   ),
    //   new RasterChunk(
    //     7,
    //     false,
    //     20,
    //     0,
    //     12, 6, 18, 10,
    //     -1, 1, 1, -1
    //   ),
    //   new RasterChunk(
    //     8,
    //     false,
    //     20,
    //     0,
    //     0, 0, 10, 10,
    //     0, 0, 0, 0
    //   )
    // ];
    //
    // const rawInputEdges = [
    //   new RasterEdge(
    //     0,
    //     true,
    //     false,
    //     new Vector2( 10, 0 ),
    //     new Vector2( 10, 6 )
    //   ),
    //   new RasterEdge(
    //     0,
    //     false,
    //     false,
    //     new Vector2( 10, 6 ),
    //     new Vector2( 0, 10 )
    //   ),
    //   new RasterEdge(
    //     0,
    //     false,
    //     false,
    //     new Vector2( 1, 1 ),
    //     new Vector2( 3, 6 )
    //   ),
    //   new RasterEdge(
    //     0,
    //     false,
    //     false,
    //     new Vector2( 3, 6 ),
    //     new Vector2( 4, 2 )
    //   ),
    //   new RasterEdge(
    //     0,
    //     false,
    //     true,
    //     new Vector2( 4, 2 ),
    //     new Vector2( 1, 1 )
    //   ),
    //   new RasterEdge(
    //     1,
    //     true,
    //     false,
    //     new Vector2( 20, 0 ),
    //     new Vector2( 20, 2 )
    //   ),
    //   new RasterEdge(
    //     1,
    //     false,
    //     false,
    //     new Vector2( 20, 2 ),
    //     new Vector2( 10, 6 )
    //   ),
    //   new RasterEdge(
    //     1,
    //     false,
    //     true,
    //     new Vector2( 10, 6 ),
    //     new Vector2( 10, 0 )
    //   ),
    //   new RasterEdge(
    //     2,
    //     true,
    //     true,
    //     new Vector2( 10, 8 ),
    //     new Vector2( 9, 10 )
    //   ),
    //   new RasterEdge(
    //     3,
    //     true,
    //     false,
    //     new Vector2( 7.5, 9 ),
    //     new Vector2( 9, 9 )
    //   ),
    //   new RasterEdge(
    //     3,
    //     false,
    //     false,
    //     new Vector2( 9, 9 ),
    //     new Vector2( 9, 10 )
    //   ),
    //   new RasterEdge(
    //     3,
    //     false,
    //     false,
    //     new Vector2( 9, 10 ),
    //     new Vector2( 7.5, 10 )
    //   ),
    //   new RasterEdge(
    //     3,
    //     false,
    //     true,
    //     new Vector2( 7.5, 10 ),
    //     new Vector2( 7.5, 9 )
    //   ),
    //   new RasterEdge(
    //     4,
    //     true,
    //     false,
    //     new Vector2( 10, 9 ),
    //     new Vector2( 11, 9 )
    //   ),
    //   new RasterEdge(
    //     4,
    //     false,
    //     false,
    //     new Vector2( 11, 9 ),
    //     new Vector2( 10, 10 )
    //   ),
    //   new RasterEdge(
    //     4,
    //     false,
    //     false,
    //     new Vector2( 10, 10 ),
    //     new Vector2( 10, 9 )
    //   ),
    //   new RasterEdge(
    //     4,
    //     false,
    //     false,
    //     new Vector2( 19, 9 ),
    //     new Vector2( 20, 9 )
    //   ),
    //   new RasterEdge(
    //     4,
    //     false,
    //     false,
    //     new Vector2( 20, 9 ),
    //     new Vector2( 19, 10 )
    //   ),
    //   new RasterEdge(
    //     4,
    //     false,
    //     true,
    //     new Vector2( 19, 10 ),
    //     new Vector2( 19, 9 )
    //   ),
    //   new RasterEdge(
    //     5,
    //     true,
    //     true,
    //     new Vector2( 20, 4 ),
    //     new Vector2( 19, 5 )
    //   )
    // ];

    const rawInputEdges: RasterEdge[] = [];
    const unprocessedEdges = TestToCanvas.getTestPath().toEdgedFace().edges;
    unprocessedEdges.forEach( ( edge, i ) => {
      rawInputEdges.push( new RasterEdge(
        0,
        i === 0,
        i === unprocessedEdges.length - 1,
        // NOTE: reversed here, due to our test path!!!
        edge.endPoint.timesScalar( 0.35 ),
        edge.startPoint.timesScalar( 0.35 )
      ) );
    } );
    const rawInputChunks = [ new RasterChunk(
      0,
      false,
      0,
      rawInputEdges.length,
      0, 0, 256, 256,
      0, 0, 0, 0
    ) ];

    const numInputChunks = rawInputChunks.length;
    const numInputEdges = rawInputEdges.length;

    const inputChunks = new ParallelStorageArray( rawInputChunks, RasterChunk.INDETERMINATE );
    const inputEdges = new ParallelStorageArray( rawInputEdges, RasterEdge.INDETERMINATE );

    assert && RasterChunk.validate( inputChunks, inputEdges, numInputChunks, numInputEdges );

    let numChunks = numInputChunks;
    let numEdges = numInputEdges;
    let chunks = inputChunks;
    let edges = inputEdges;

    const finishedChunks = [];

    let stageCount = 1;
    while ( numChunks > 0 ) {
      console.log( `Stage ${stageCount++}` );
      LOG && console.log( '**********' );
      LOG && console.log( '**********' );
      LOG && console.log( '**********' );
      LOG && console.log( '**********' );
      LOG && console.log( '**********' );

      const result = await ParallelRaster.process( WORKGROUP_SIZE, numChunks, numEdges, chunks, edges );

      finishedChunks.push( ...result.completeChunks.data.slice( 0, result.numCompleteChunks ) );

      numChunks = result.numReducibleChunks;
      numEdges = result.numReducibleEdges;
      chunks = result.reducibleChunks;
      edges = result.reducibleEdges;
    }

    // TODO: CombinedRaster defaults
    const raster = new CombinedRaster( 256, 256, {
      colorSpace: 'display-p3',
      showOutOfGamut: false
    } );

    const color = new Vector4( 1, 0, 0, 1 );
    finishedChunks.forEach( chunk => {
      if ( chunk.isFullArea ) {
        raster.addClientFullRegion( color, chunk.minX, chunk.minY, chunk.maxX - chunk.minX, chunk.maxY - chunk.minY );
      }
      else {
        raster.addClientPartialPixel( color.timesScalar( chunk.area ), chunk.minX, chunk.minY );
      }
    } );

    const canvas = raster.toCanvas();
    canvas.style.width = '512px';
    canvas.style.height = '512px';
    canvas.style.imageRendering = 'pixelated';
    canvas.style.position = 'absolute';
    document.body.appendChild( canvas );
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

    const createStorage = <T>( length: number, indeterminateValue: T ) => new ParallelStorageArray(
      _.range( 0, ByteEncoder.alignUp( length, workgroupSize ) ).map( () => indeterminateValue ),
      indeterminateValue
    );

    LOG && console.log( `numInputChunks: ${numInputChunks}` );
    LOG && console.log( inputChunks.data.slice( 0, numInputChunks ).map( toIndexedString ).join( '\n' ) );

    LOG && console.log( `numInputEdges: ${numInputEdges}` );
    LOG && console.log( inputEdges.data.slice( 0, numInputEdges ).map( toIndexedString ).join( '\n' ) );

    const clippedChunks = createStorage( numClippedChunks, RasterClippedChunk.INDETERMINATE );

    LOG && console.log( 'ParallelRasterInitialChunk dispatch' );
    await ParallelRasterInitialChunk.dispatch(
      workgroupSize,
      inputChunks,
      numInputChunks,
      clippedChunks
    );

    LOG && console.log( 'clippedChunks (without reduce)' );
    LOG && console.log( clippedChunks.data.slice( 0, numClippedChunks ).map( toIndexedString ).join( '\n' ) );

    const edgeClips = createStorage( numEdgeClips, RasterEdgeClip.INDETERMINATE );
    const chunkReduces0 = createStorage( Math.ceil( numInputEdges / workgroupSize ), RasterChunkReduceBlock.INDETERMINATE );
    const debugFullChunkReduces = createStorage( numInputEdges, { min: RasterChunkReduceData.INDETERMINATE, max: RasterChunkReduceData.INDETERMINATE } );

    LOG && console.log( 'ParallelRasterInitialClip dispatch' );
    await ParallelRasterInitialClip.dispatch(
      workgroupSize,
      inputChunks, inputEdges,
      numInputEdges,
      clippedChunks,
      edgeClips, chunkReduces0, debugFullChunkReduces
    );

    LOG && console.log( 'edgeClips' );
    LOG && console.log( edgeClips.data.slice( 0, numEdgeClips ).map( toIndexedString ).join( '\n' ) );

    LOG && console.log( 'debugFullChunkReduces' );
    LOG && console.log( debugFullChunkReduces.data.slice( 0, numInputEdges ).flatMap( ( n, i ) => [
      `${i} min: ${n.min.toString()}`,
      `${i.toString().replace( /./g, ' ' )} max: ${n.max.toString()}`
    ] ).join( '\n' ) );

    LOG && console.log( 'chunkReduces0' );
    LOG && console.log( chunkReduces0.data.slice( 0, Math.ceil( numInputEdges / workgroupSize ) ).flatMap( ( n, i ) => [
      `${i} leftMin: ${n.leftMin.toString()}`,
      `${i.toString().replace( /./g, ' ' )} rightMin: ${n.rightMin.toString()}`,
      `${i.toString().replace( /./g, ' ' )} leftMax: ${n.leftMax.toString()}`,
      `${i.toString().replace( /./g, ' ' )} rightMax: ${n.rightMax.toString()}`
    ] ).join( '\n' ) );

    const chunkReduces1 = createStorage( Math.ceil( numInputEdges / ( workgroupSize * workgroupSize ) ), RasterChunkReduceBlock.INDETERMINATE );

    LOG && console.log( 'ParallelRasterChunkReduce dispatch' );
    await ParallelRasterChunkReduce.dispatch(
      workgroupSize,
      chunkReduces0,
      Math.ceil( numInputEdges / workgroupSize ),
      clippedChunks,
      chunkReduces1
    );

    LOG && console.log( 'chunkReduces1' );
    LOG && console.log( chunkReduces1.data.slice( 0, Math.ceil( numInputEdges / ( workgroupSize * workgroupSize ) ) ).flatMap( ( n, i ) => [
      `${i} leftMin: ${n.leftMin.toString()}`,
      `${i.toString().replace( /./g, ' ' )} rightMin: ${n.rightMin.toString()}`,
      `${i.toString().replace( /./g, ' ' )} leftMax: ${n.leftMax.toString()}`,
      `${i.toString().replace( /./g, ' ' )} rightMax: ${n.rightMax.toString()}`
    ] ).join( '\n' ) );

    const chunkReduces2 = createStorage( Math.ceil( numInputEdges / ( workgroupSize * workgroupSize * workgroupSize ) ), RasterChunkReduceBlock.INDETERMINATE );

    LOG && console.log( 'ParallelRasterChunkReduce dispatch' );
    await ParallelRasterChunkReduce.dispatch(
      workgroupSize,
      chunkReduces1,
      Math.ceil( numInputEdges / ( workgroupSize * workgroupSize ) ),
      clippedChunks,
      chunkReduces2
    );

    LOG && console.log( 'chunkReduces2' );
    LOG && console.log( chunkReduces2.data.slice( 0, Math.ceil( numInputEdges / ( workgroupSize * workgroupSize * workgroupSize ) ) ).flatMap( ( n, i ) => [
      `${i} leftMin: ${n.leftMin.toString()}`,
      `${i.toString().replace( /./g, ' ' )} rightMin: ${n.rightMin.toString()}`,
      `${i.toString().replace( /./g, ' ' )} leftMax: ${n.leftMax.toString()}`,
      `${i.toString().replace( /./g, ' ' )} rightMax: ${n.rightMax.toString()}`
    ] ).join( '\n' ) );

    LOG && console.log( 'clippedChunks (with reduce)' );
    LOG && console.log( clippedChunks.data.slice( 0, numClippedChunks ).map( toIndexedString ).join( '\n' ) );

    /*
     * "split" reduce/scan, to distribute the chunks into reducibleChunks/completeChunks
     */

    const debugFullSplitReduces = createStorage( numClippedChunks, RasterSplitReduceData.INDETERMINATE );
    const splitReduces0 = createStorage( Math.ceil( numClippedChunks / workgroupSize ), RasterSplitReduceData.INDETERMINATE );

    LOG && console.log( 'ParallelRasterInitialSplitReduce dispatch' );
    await ParallelRasterInitialSplitReduce.dispatch(
      workgroupSize,
      clippedChunks,
      numClippedChunks,
      debugFullSplitReduces, splitReduces0
    );

    LOG && console.log( 'debugFullSplitReduces' );
    LOG && console.log( debugFullSplitReduces.data.slice( 0, numClippedChunks ).map( toIndexedString ).join( '\n' ) );

    LOG && console.log( 'splitReduces0 (reduced)' );
    LOG && console.log( splitReduces0.data.slice( 0, Math.ceil( numClippedChunks / workgroupSize ) ).map( toIndexedString ).join( '\n' ) );

    const splitReduces1 = createStorage( Math.ceil( numClippedChunks / ( workgroupSize * workgroupSize ) ), RasterSplitReduceData.INDETERMINATE );

    LOG && console.log( 'ParallelRasterEdgeReduce dispatch' );
    await ParallelRasterEdgeReduce.dispatch(
      workgroupSize,
      Math.ceil( numClippedChunks / workgroupSize ),
      splitReduces0,
      splitReduces1
    );

    LOG && console.log( 'splitReduces0 (scanned)' );
    LOG && console.log( splitReduces0.data.slice( 0, Math.ceil( numClippedChunks / workgroupSize ) ).map( toIndexedString ).join( '\n' ) );

    LOG && console.log( 'splitReduces1 (reduced)' );
    LOG && console.log( splitReduces1.data.slice( 0, Math.ceil( numClippedChunks / ( workgroupSize * workgroupSize ) ) ).map( toIndexedString ).join( '\n' ) );

    const splitReduces2 = createStorage( Math.ceil( numClippedChunks / ( workgroupSize * workgroupSize * workgroupSize ) ), RasterSplitReduceData.INDETERMINATE );

    LOG && console.log( 'ParallelRasterEdgeReduce dispatch' );
    await ParallelRasterEdgeReduce.dispatch(
      workgroupSize,
      Math.ceil( numClippedChunks / ( workgroupSize * workgroupSize ) ),
      splitReduces1,
      splitReduces2
    );

    LOG && console.log( 'splitReduces1 (scanned)' );
    LOG && console.log( splitReduces1.data.slice( 0, Math.ceil( numClippedChunks / ( workgroupSize * workgroupSize ) ) ).map( toIndexedString ).join( '\n' ) );

    LOG && console.log( 'splitReduces2 (reduced)' );
    LOG && console.log( splitReduces2.data.slice( 0, Math.ceil( numClippedChunks / ( workgroupSize * workgroupSize * workgroupSize ) ) ).map( toIndexedString ).join( '\n' ) );

    assert && assert( Math.ceil( numClippedChunks / ( workgroupSize * workgroupSize * workgroupSize ) ) === 1 );

    const reducibleChunkCount = splitReduces2.data[ 0 ].numReducible;
    const completeChunkCount = splitReduces2.data[ 0 ].numComplete;

    const reducibleChunks = createStorage( reducibleChunkCount, RasterChunk.INDETERMINATE );
    const completeChunks = createStorage( completeChunkCount, RasterCompleteChunk.INDETERMINATE );
    const chunkIndexMap = createStorage( numClippedChunks, NaN );

    LOG && console.log( 'ParallelRasterSplitScan dispatch' );
    await ParallelRasterSplitScan.dispatch(
      workgroupSize,
      clippedChunks, splitReduces0, splitReduces1, splitReduces2,
      numClippedChunks,
      reducibleChunks, completeChunks, chunkIndexMap
    );

    LOG && console.log( `reducibleChunks ${reducibleChunkCount}` );
    LOG && console.log( reducibleChunks.data.slice( 0, reducibleChunkCount ).map( toIndexedString ).join( '\n' ) );

    LOG && console.log( `completeChunks ${completeChunkCount}` );
    LOG && console.log( completeChunks.data.slice( 0, completeChunkCount ).map( toIndexedString ).join( '\n' ) );

    LOG && console.log( 'chunkIndexMap' );
    LOG && console.log( chunkIndexMap.data.slice( 0, numClippedChunks ).map( toIndexedString ).join( '\n' ) );

    /*
     * "edge" reduce/scan, to distribute the edges into reducibleEdges/completeEdges
     */

    const debugFullEdgeReduces = createStorage( numEdgeClips, RasterSplitReduceData.INDETERMINATE );
    const edgeReduces0 = createStorage( Math.ceil( numEdgeClips / workgroupSize ), RasterSplitReduceData.INDETERMINATE );

    LOG && console.log( 'ParallelRasterInitialEdgeReduce dispatch' );
    await ParallelRasterInitialEdgeReduce.dispatch(
      workgroupSize,
      clippedChunks, edgeClips,
      numEdgeClips,
      debugFullEdgeReduces, edgeReduces0
    );

    LOG && console.log( 'debugFullEdgeReduces' );
    LOG && console.log( debugFullEdgeReduces.data.slice( 0, numEdgeClips ).map( toIndexedString ).join( '\n' ) );

    LOG && console.log( 'edgeReduces0 (reduced)' );
    LOG && console.log( edgeReduces0.data.slice( 0, Math.ceil( numEdgeClips / workgroupSize ) ).map( toIndexedString ).join( '\n' ) );

    const edgeReduces1 = createStorage( Math.ceil( numEdgeClips / ( workgroupSize * workgroupSize ) ), RasterSplitReduceData.INDETERMINATE );

    LOG && console.log( 'ParallelRasterEdgeReduce dispatch' );
    await ParallelRasterEdgeReduce.dispatch(
      workgroupSize,
      Math.ceil( numEdgeClips / workgroupSize ),
      edgeReduces0,
      edgeReduces1
    );

    LOG && console.log( 'edgeReduces0 (scanned)' );
    LOG && console.log( edgeReduces0.data.slice( 0, Math.ceil( numEdgeClips / workgroupSize ) ).map( toIndexedString ).join( '\n' ) );

    LOG && console.log( 'edgeReduces1 (reduced)' );
    LOG && console.log( edgeReduces1.data.slice( 0, Math.ceil( numEdgeClips / ( workgroupSize * workgroupSize ) ) ).map( toIndexedString ).join( '\n' ) );

    const edgeReduces2 = createStorage( Math.ceil( numEdgeClips / ( workgroupSize * workgroupSize * workgroupSize ) ), RasterSplitReduceData.INDETERMINATE );

    LOG && console.log( 'ParallelRasterEdgeReduce dispatch' );
    await ParallelRasterEdgeReduce.dispatch(
      workgroupSize,
      Math.ceil( numEdgeClips / ( workgroupSize * workgroupSize ) ),
      edgeReduces1,
      edgeReduces2
    );

    LOG && console.log( 'edgeReduces1 (scanned)' );
    LOG && console.log( edgeReduces1.data.slice( 0, Math.ceil( numEdgeClips / ( workgroupSize * workgroupSize ) ) ).map( toIndexedString ).join( '\n' ) );

    LOG && console.log( 'edgeReduces2 (reduced)' );
    LOG && console.log( edgeReduces2.data.slice( 0, Math.ceil( numEdgeClips / ( workgroupSize * workgroupSize * workgroupSize ) ) ).map( toIndexedString ).join( '\n' ) );

    assert && assert( Math.ceil( numEdgeClips / ( workgroupSize * workgroupSize * workgroupSize ) ) === 1 );

    const reducibleEdgeCount = edgeReduces2.data[ 0 ].numReducible;
    const completeEdgeCount = edgeReduces2.data[ 0 ].numComplete;

    const reducibleEdges = createStorage( reducibleEdgeCount, RasterEdge.INDETERMINATE );
    const completeEdges = createStorage( completeEdgeCount, RasterCompleteEdge.INDETERMINATE );
    const chunkIndices = createStorage( numClippedChunks * 2, NaN );
    const debugEdgeScan = createStorage( numEdgeClips, RasterSplitReduceData.INDETERMINATE );

    LOG && console.log( 'ParallelRasterEdgeScan dispatch' );
    await ParallelRasterEdgeScan.dispatch(
      workgroupSize,
      clippedChunks, edgeClips, edgeReduces0, edgeReduces1, edgeReduces2,
      numEdgeClips,
      reducibleEdges, completeEdges, chunkIndices, debugEdgeScan
    );

    LOG && console.log( `reducibleEdges ${reducibleEdgeCount}` );
    LOG && console.log( reducibleEdges.data.slice( 0, reducibleEdgeCount ).map( toIndexedString ).join( '\n' ) );

    LOG && console.log( `completeEdges ${completeEdgeCount}` );
    LOG && console.log( completeEdges.data.slice( 0, completeEdgeCount ).map( toIndexedString ).join( '\n' ) );

    LOG && console.log( 'chunkIndices' );
    // each has a min/max!
    LOG && console.log( chunkIndices.data.slice( 0, numClippedChunks * 2 ).map( toIndexedString ).join( '\n' ) );

    LOG && console.log( 'debugEdgeScan' );
    LOG && console.log( debugEdgeScan.data.slice( 0, numEdgeClips ).map( toIndexedString ).join( '\n' ) );

    LOG && console.log( 'ParallelRasterChunkIndexPatch dispatch' );
    await ParallelRasterChunkIndexPatch.dispatch(
      workgroupSize,
      chunkIndexMap, chunkIndices, clippedChunks,
      numClippedChunks,
      reducibleChunks, completeChunks
    );

    LOG && console.log( `reducibleChunks ${reducibleChunkCount}` );
    LOG && console.log( reducibleChunks.data.slice( 0, reducibleChunkCount ).map( toIndexedString ).join( '\n' ) );

    LOG && console.log( `completeChunks ${completeChunkCount}` );
    LOG && console.log( completeChunks.data.slice( 0, completeChunkCount ).map( toIndexedString ).join( '\n' ) );

    LOG && console.log( 'ParallelRasterEdgeIndexPatch dispatch' );
    await ParallelRasterEdgeIndexPatch.dispatch(
      workgroupSize,
      chunkIndexMap, chunkIndices,
      reducibleEdgeCount,
      reducibleEdges
    );

    LOG && console.log( `reducibleEdges ${reducibleEdgeCount}` );
    LOG && console.log( reducibleEdges.data.slice( 0, reducibleEdgeCount ).map( toIndexedString ).join( '\n' ) );

    LOG && console.log( `completeEdges ${completeEdgeCount}` );
    LOG && console.log( completeEdges.data.slice( 0, completeEdgeCount ).map( toIndexedString ).join( '\n' ) );

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
