// Copyright 2023, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, ParallelExecutor, ParallelKernel, ParallelStorageArray, ParallelWorkgroupArray, RasterClippedChunk, RasterEdge, RasterEdgeClip, RasterEdgeReduceData } from '../../imports.js';
import Vector2 from '../../../../dot/js/Vector2.js';

const nanVector = new Vector2( NaN, NaN );

export default class ParallelRasterEdgeScan {
  public static async dispatch(
    workgroupSize: number,

    // input
    clippedChunks: ParallelStorageArray<RasterClippedChunk>,
    edgeClips: ParallelStorageArray<RasterEdgeClip>,
    edgeReduces0: ParallelStorageArray<RasterEdgeReduceData>,
    edgeReduces1: ParallelStorageArray<RasterEdgeReduceData>,
    edgeReduces2: ParallelStorageArray<RasterEdgeReduceData>,
    numEdges: number,
    numChunks: number,

    // output
    reducibleEdges: ParallelStorageArray<RasterEdge>,
    completeEdges: ParallelStorageArray<RasterEdge>,
    chunkIndices: ParallelStorageArray<number>
  ): Promise<void> {
    const logWorkgroupSize = Math.log2( workgroupSize );

    type WorkgroupValues = {
      reduces: ParallelWorkgroupArray<RasterEdgeReduceData>;
      baseIndices: ParallelWorkgroupArray<number>; // [ reducible, complete ], implement with two workgroup values
    };

    const kernel = new ParallelKernel<WorkgroupValues>( async context => {
      await context.start();

      const edgeIndex = context.globalId.x;
      const exists = edgeIndex < numEdges * 2; // we have 2 clips for each edge

      // TODO: better way to scan? Does this lead to inefficient memory?
      if ( context.localId.x === 0 ) {
        const index0 = Math.floor( edgeIndex / workgroupSize );
        const index1 = Math.floor( index0 / workgroupSize );
        const index2 = Math.floor( index1 / workgroupSize );

        // Convert to an exclusive scan with the different indices
        const reduce0 = index0 > 0 ? ( await edgeReduces0.get( context, index0 - 1 ) ) : RasterEdgeReduceData.IDENTITY;
        const reduce1 = index1 > 0 ? ( await edgeReduces1.get( context, index1 - 1 ) ) : RasterEdgeReduceData.IDENTITY;
        const reduce2 = index2 > 0 ? ( await edgeReduces2.get( context, index2 - 1 ) ) : RasterEdgeReduceData.IDENTITY;

        const baseReducible = reduce2.numReducible + reduce1.numReducible + reduce0.numReducible;
        const baseComplete = reduce2.numComplete + reduce1.numComplete + reduce0.numComplete;

        console.log( context.workgroupId.x, index0, index1, index2, reduce0, reduce1, reduce2, baseReducible, baseComplete );

        await context.workgroupValues.baseIndices.set( context, 0, baseReducible );
        await context.workgroupValues.baseIndices.set( context, 1, baseComplete );

        // We'll have a barrier before we read this due to the scan, so we don't need to worry much about this
      }

      const edgeClip = await edgeClips.get( context, context.globalId.x );
      const clippedChunk = await clippedChunks.get( context, edgeClip.chunkIndex );

      const initialValue = RasterEdgeReduceData.from( edgeClip, clippedChunk, exists );
      let value = initialValue;

      await context.workgroupValues.reduces.set( context, context.localId.x, value );

      for ( let i = 0; i < logWorkgroupSize; i++ ) {
        await context.workgroupBarrier();
        const delta = 1 << i;
        if ( context.localId.x >= delta ) {
          const other = await context.workgroupValues.reduces.get( context, context.localId.x - delta );
          value = RasterEdgeReduceData.combine( other, value );
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

        const hasReducedVertices = clippedChunk.isReducible;
        const hasCompleteVertices = clippedChunk.isExportingCompleteEdges();
        let baseIndex = 0; // filled in later

        if ( hasReducedVertices ) {
          // Convert to exclusive prefix sum TODO better way
          baseIndex = baseReducible + value.numReducible - initialValue.numReducible;

          if ( index > 0 ) {
            await reducibleEdges.set( context, baseIndex, new RasterEdge(
              edgeClip.chunkIndex,
              edgeClip.isFirstEdge, edgeClip.isLastEdge && index === 1,
              edgeStarts[ 0 ], edgeEnds[ 0 ]
            ) );
            if ( index > 1 ) {
              await reducibleEdges.set( context, baseIndex + 1, new RasterEdge(
                edgeClip.chunkIndex,
                false, edgeClip.isLastEdge && index === 2,
                edgeStarts[ 1 ], edgeEnds[ 1 ]
              ) );
              if ( index > 2 ) {
                await reducibleEdges.set( context, baseIndex + 2, new RasterEdge(
                  edgeClip.chunkIndex,
                  false, edgeClip.isLastEdge,
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
              edgeClip.isFirstEdge, edgeClip.isLastEdge && index === 1,
              edgeStarts[ 0 ], edgeEnds[ 0 ]
            ) );
            if ( index > 1 ) {
              await completeEdges.set( context, baseIndex + 1, new RasterEdge(
                edgeClip.chunkIndex,
                false, edgeClip.isLastEdge && index === 2,
                edgeStarts[ 1 ], edgeEnds[ 1 ]
              ) );
              if ( index > 2 ) {
                await completeEdges.set( context, baseIndex + 2, new RasterEdge(
                  edgeClip.chunkIndex,
                  false, edgeClip.isLastEdge,
                  edgeStarts[ 2 ], edgeEnds[ 2 ]
                ) );
              }
            }
          }
        }

        // chunk indices
        if ( hasReducedVertices || hasCompleteVertices ) {
          if ( edgeClip.isFirstEdge ) {
            await chunkIndices.set( context, 2 * edgeClip.chunkIndex, baseIndex );
          }

          if ( edgeClip.isLastEdge ) {
            await chunkIndices.set( context, 2 * edgeClip.chunkIndex + 1, baseIndex + index );
          }
        }
      }
    }, () => ( {
      reduces: new ParallelWorkgroupArray( _.range( 0, workgroupSize ).map( () => RasterEdgeReduceData.INDETERMINATE ), RasterEdgeReduceData.INDETERMINATE ),
      baseIndices: new ParallelWorkgroupArray( [ 0, 0 ], 0 )
    } ), [ clippedChunks, edgeClips, edgeReduces0, edgeReduces1, edgeReduces2, reducibleEdges, completeEdges, chunkIndices ], workgroupSize );

    await ( new ParallelExecutor( kernel ).dispatch( Math.ceil( numEdges * 2 / workgroupSize ) ) );
  }
}

alpenglow.register( 'ParallelRasterEdgeScan', ParallelRasterEdgeScan );
