// Copyright 2023, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, ParallelExecutor, ParallelKernel, ParallelStorageArray, ParallelWorkgroupArray, RasterClippedChunk, RasterEdge, RasterEdgeClip, RasterSplitReduceData } from '../../imports.js';
import Vector2 from '../../../../dot/js/Vector2.js';

const nanVector = new Vector2( NaN, NaN );

export default class ParallelRasterEdgeScan {
  public static async dispatch(
    workgroupSize: number,

    // input
    clippedChunks: ParallelStorageArray<RasterClippedChunk>,
    edgeClips: ParallelStorageArray<RasterEdgeClip>,
    edgeReduces0: ParallelStorageArray<RasterSplitReduceData>,
    edgeReduces1: ParallelStorageArray<RasterSplitReduceData>,
    edgeReduces2: ParallelStorageArray<RasterSplitReduceData>,
    numEdges: number,
    numChunks: number,

    // output
    reducibleEdges: ParallelStorageArray<RasterEdge>,
    completeEdges: ParallelStorageArray<RasterEdge>,
    chunkIndices: ParallelStorageArray<number>
  ): Promise<void> {
    const logWorkgroupSize = Math.log2( workgroupSize );

    type WorkgroupValues = {
      reduces: ParallelWorkgroupArray<RasterSplitReduceData>;
      baseIndices: ParallelWorkgroupArray<number>; // [ reducible, complete ], implement with two workgroup values
    };

    const kernel = new ParallelKernel<WorkgroupValues>( async context => {
      await context.start();

      const edgeIndex = context.globalId.x;
      const exists = edgeIndex < numEdges * 2; // we have 2 clips for each edge
      // TODO: numEdges => numClippedEdges, it will be better for computations

      // TODO: better way to scan? Does this lead to inefficient memory?
      if ( context.localId.x === 0 ) {
        const index0 = Math.floor( edgeIndex / workgroupSize );
        const index1 = Math.floor( index0 / workgroupSize );
        const index2 = Math.floor( index1 / workgroupSize );

        // Convert to an exclusive scan with the different indices
        const reduce0 = index0 > 0 ? ( await edgeReduces0.get( context, index0 - 1 ) ) : RasterSplitReduceData.IDENTITY;
        const reduce1 = index1 > 0 ? ( await edgeReduces1.get( context, index1 - 1 ) ) : RasterSplitReduceData.IDENTITY;
        const reduce2 = index2 > 0 ? ( await edgeReduces2.get( context, index2 - 1 ) ) : RasterSplitReduceData.IDENTITY;

        const baseReducible = reduce2.numReducible + reduce1.numReducible + reduce0.numReducible;
        const baseComplete = reduce2.numComplete + reduce1.numComplete + reduce0.numComplete;

        await context.workgroupValues.baseIndices.set( context, 0, baseReducible );
        await context.workgroupValues.baseIndices.set( context, 1, baseComplete );

        // We'll have a barrier before we read this due to the scan, so we don't need to worry much about this
      }

      const edgeClip = await edgeClips.get( context, context.globalId.x );
      const clippedChunk = await clippedChunks.get( context, edgeClip.chunkIndex );

      const initialValue = RasterSplitReduceData.from( edgeClip, clippedChunk, exists );
      let value = initialValue;

      await context.workgroupValues.reduces.set( context, context.localId.x, value );

      for ( let i = 0; i < logWorkgroupSize; i++ ) {
        await context.workgroupBarrier();
        const delta = 1 << i;
        if ( context.localId.x >= delta ) {
          const other = await context.workgroupValues.reduces.get( context, context.localId.x - delta );
          value = RasterSplitReduceData.combine( other, value );
        }

        await context.workgroupBarrier();
        await context.workgroupValues.reduces.set( context, context.localId.x, value );
      }

      if ( exists ) {
        const baseReducible = await context.workgroupValues.baseIndices.get( context, 0 );
        const baseComplete = await context.workgroupValues.baseIndices.get( context, 1 );

        const edgeStarts = [ nanVector, nanVector, nanVector ];
        const edgeEnds = [ nanVector, nanVector, nanVector ];

        let index = 0;
        if ( !edgeClip.point0.equals( edgeClip.point1 ) ) {
          edgeStarts[ index ] = edgeClip.point0;
          edgeEnds[ index ] = edgeClip.point1;
          index++;
        }
        if ( !edgeClip.point1.equals( edgeClip.point2 ) ) {
          edgeStarts[ index ] = edgeClip.point1;
          edgeEnds[ index ] = edgeClip.point2;
          index++;
        }
        if ( !edgeClip.point2.equals( edgeClip.point3 ) ) {
          edgeStarts[ index ] = edgeClip.point2;
          edgeEnds[ index ] = edgeClip.point3;
          index++;
        }

        const hasReducibleVertices = clippedChunk.isReducible;
        const hasCompleteVertices = clippedChunk.isExportingCompleteEdges();
        let baseIndex = 0; // filled in later

        if ( hasReducibleVertices ) {
          // Convert to exclusive prefix sum TODO better way
          baseIndex = baseReducible + value.numReducible - initialValue.numReducible;

          if ( index > 0 ) {
            await reducibleEdges.set( context, baseIndex, new RasterEdge(
              edgeClip.chunkIndex,
              false, false, // will get filled in later
              edgeStarts[ 0 ], edgeEnds[ 0 ]
            ) );
            if ( index > 1 ) {
              await reducibleEdges.set( context, baseIndex + 1, new RasterEdge(
                edgeClip.chunkIndex,
                false, false, // will get filled in later
                edgeStarts[ 1 ], edgeEnds[ 1 ]
              ) );
              if ( index > 2 ) {
                await reducibleEdges.set( context, baseIndex + 2, new RasterEdge(
                  edgeClip.chunkIndex,
                  false, false, // will get filled in later
                  edgeStarts[ 2 ], edgeEnds[ 2 ]
                ) );
              }
            }
          }
        }

        if ( hasCompleteVertices ) {
          // Convert to exclusive prefix sum TODO better way
          baseIndex = baseComplete + value.numComplete - initialValue.numComplete;

          if ( index > 0 ) {
            await completeEdges.set( context, baseIndex, new RasterEdge(
              edgeClip.chunkIndex,
              false, false, // will get filled in later
              edgeStarts[ 0 ], edgeEnds[ 0 ]
            ) );
            if ( index > 1 ) {
              await completeEdges.set( context, baseIndex + 1, new RasterEdge(
                edgeClip.chunkIndex,
                false, false, // will get filled in later
                edgeStarts[ 1 ], edgeEnds[ 1 ]
              ) );
              if ( index > 2 ) {
                await completeEdges.set( context, baseIndex + 2, new RasterEdge(
                  edgeClip.chunkIndex,
                  false, false, // will get filled in later
                  edgeStarts[ 2 ], edgeEnds[ 2 ]
                ) );
              }
            }
          }
        }

        // chunk indices
        // TODO: ... can we just output the end of each, and when we distribute the chunks, we can just use the previous one?
        if ( hasReducibleVertices || hasCompleteVertices ) {
          if ( edgeClip.isFirstEdge ) {
            await chunkIndices.set( context, 2 * edgeClip.chunkIndex, baseIndex );
          }

          if ( edgeClip.isLastEdge ) {
            await chunkIndices.set( context, 2 * edgeClip.chunkIndex + 1, baseIndex + index );
          }
        }
      }
    }, () => ( {
      reduces: new ParallelWorkgroupArray( _.range( 0, workgroupSize ).map( () => RasterSplitReduceData.INDETERMINATE ), RasterSplitReduceData.INDETERMINATE ),
      baseIndices: new ParallelWorkgroupArray( [ 0, 0 ], 0 )
    } ), [ clippedChunks, edgeClips, edgeReduces0, edgeReduces1, edgeReduces2, reducibleEdges, completeEdges, chunkIndices ], workgroupSize );

    await ( new ParallelExecutor( kernel ).dispatch( Math.ceil( numEdges * 2 / workgroupSize ) ) );
  }
}

alpenglow.register( 'ParallelRasterEdgeScan', ParallelRasterEdgeScan );
