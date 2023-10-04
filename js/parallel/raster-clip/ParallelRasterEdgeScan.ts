// Copyright 2023, University of Colorado Boulder

/**
 * Multiple stream compaction: distributes the relevant data from the RasterEdgeClips into the reducible (RasterEdge)
 * and complete (RasterCompleteEdge) locations, and generates the needed chunkIndices array as a byproduct.
 *
 * NOTE: Has similar code to ParallelRasterSplitScan
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, ParallelExecutor, ParallelKernel, ParallelStorageArray, ParallelUtils, ParallelWorkgroupArray, RasterClippedChunk, RasterCompleteEdge, RasterEdge, RasterEdgeClip, RasterSplitReduceData } from '../../imports.js';
import Vector2 from '../../../../dot/js/Vector2.js';

const nanVector = new Vector2( NaN, NaN );

export default class ParallelRasterEdgeScan {
  public static async dispatch(
    workgroupSize: number,

    // read
    clippedChunks: ParallelStorageArray<RasterClippedChunk>,
    edgeClips: ParallelStorageArray<RasterEdgeClip>,
    edgeReduces0: ParallelStorageArray<RasterSplitReduceData>,
    edgeReduces1: ParallelStorageArray<RasterSplitReduceData>,
    edgeReduces2: ParallelStorageArray<RasterSplitReduceData>,
    numEdgeClips: number,

    // write
    reducibleEdges: ParallelStorageArray<RasterEdge>,
    completeEdges: ParallelStorageArray<RasterCompleteEdge>,
    chunkIndices: ParallelStorageArray<number>,
    debugEdgeScan: ParallelStorageArray<RasterSplitReduceData>
  ): Promise<void> {
    const logWorkgroupSize = Math.log2( workgroupSize );

    type WorkgroupValues = {
      reduces: ParallelWorkgroupArray<RasterSplitReduceData>;
      baseIndices: ParallelWorkgroupArray<number>; // [ reducible, complete ], implement with two workgroup values
    };

    const kernel = new ParallelKernel<WorkgroupValues>( async context => {
      await context.start();

      const edgeIndex = context.globalId.x;
      const exists = edgeIndex < numEdgeClips;
      if ( context.localId.x === 0 ) {
        const indices = ParallelUtils.getInclusiveToExclusiveScanIndices( edgeIndex, workgroupSize );

        // Convert to an exclusive scan with the different indices
        const reduce0 = indices.x >= 0 ? ( await edgeReduces0.get( context, indices.x ) ) : RasterSplitReduceData.IDENTITY;
        const reduce1 = indices.y >= 0 ? ( await edgeReduces1.get( context, indices.y ) ) : RasterSplitReduceData.IDENTITY;
        const reduce2 = indices.z >= 0 ? ( await edgeReduces2.get( context, indices.z ) ) : RasterSplitReduceData.IDENTITY;

        const baseReducible = reduce2.numReducible + reduce1.numReducible + reduce0.numReducible;
        const baseComplete = reduce2.numComplete + reduce1.numComplete + reduce0.numComplete;

        await context.workgroupValues.baseIndices.set( context, 0, baseReducible );
        await context.workgroupValues.baseIndices.set( context, 1, baseComplete );

        // We'll have a barrier before we read this due to the scan, so we don't need to worry much about this
      }

      const edgeClip = await edgeClips.get( context, context.globalId.x );
      const clippedChunk = await clippedChunks.get( context, edgeClip.clippedChunkIndex );

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

        await debugEdgeScan.set( context, context.globalId.x, new RasterSplitReduceData(
          baseReducible + value.numReducible - initialValue.numReducible,
          baseComplete + value.numComplete - initialValue.numComplete
        ) );

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
          // Convert to exclusive prefix sum
          baseIndex = baseReducible + value.numReducible - initialValue.numReducible;

          if ( index > 0 ) {
            await reducibleEdges.set( context, baseIndex, new RasterEdge(
              edgeClip.clippedChunkIndex,
              false, false, // will get filled in later
              edgeStarts[ 0 ], edgeEnds[ 0 ]
            ) );
            if ( index > 1 ) {
              await reducibleEdges.set( context, baseIndex + 1, new RasterEdge(
                edgeClip.clippedChunkIndex,
                false, false, // will get filled in later
                edgeStarts[ 1 ], edgeEnds[ 1 ]
              ) );
              if ( index > 2 ) {
                await reducibleEdges.set( context, baseIndex + 2, new RasterEdge(
                  edgeClip.clippedChunkIndex,
                  false, false, // will get filled in later
                  edgeStarts[ 2 ], edgeEnds[ 2 ]
                ) );
              }
            }
          }
        }

        if ( hasCompleteVertices ) {
          // Convert to exclusive prefix sum
          baseIndex = baseComplete + value.numComplete - initialValue.numComplete;

          if ( index > 0 ) {
            await completeEdges.set( context, baseIndex, new RasterCompleteEdge(
              edgeStarts[ 0 ], edgeEnds[ 0 ]
            ) );
            if ( index > 1 ) {
              await completeEdges.set( context, baseIndex + 1, new RasterCompleteEdge(
                edgeStarts[ 1 ], edgeEnds[ 1 ]
              ) );
              if ( index > 2 ) {
                await completeEdges.set( context, baseIndex + 2, new RasterCompleteEdge(
                  edgeStarts[ 2 ], edgeEnds[ 2 ]
                ) );
              }
            }
          }
        }

        // chunk indices
        // NOTE: Can't just output the end of each, since we are splitting them across reducible/completed
        if ( hasReducibleVertices || hasCompleteVertices ) {
          if ( edgeClip.isFirstEdge ) {
            await chunkIndices.set( context, 2 * edgeClip.clippedChunkIndex, baseIndex );
          }

          if ( edgeClip.isLastEdge ) {
            await chunkIndices.set( context, 2 * edgeClip.clippedChunkIndex + 1, baseIndex + index );
          }
        }
      }
    }, () => ( {
      reduces: new ParallelWorkgroupArray( _.range( 0, workgroupSize ).map( () => RasterSplitReduceData.INDETERMINATE ), RasterSplitReduceData.INDETERMINATE ),
      baseIndices: new ParallelWorkgroupArray( [ 0, 0 ], 0 )
    } ), [ clippedChunks, edgeClips, edgeReduces0, edgeReduces1, edgeReduces2, reducibleEdges, completeEdges, chunkIndices, debugEdgeScan ], workgroupSize );

    await ( new ParallelExecutor( kernel ).dispatch( Math.ceil( numEdgeClips / workgroupSize ) ) );
  }
}

alpenglow.register( 'ParallelRasterEdgeScan', ParallelRasterEdgeScan );
