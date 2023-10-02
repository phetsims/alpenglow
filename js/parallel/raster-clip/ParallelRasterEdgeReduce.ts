// Copyright 2023, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, ParallelExecutor, ParallelKernel, ParallelStorageArray, ParallelWorkgroupArray, RasterSplitReduceData } from '../../imports.js';

export default class ParallelRasterEdgeReduce {
  public static async dispatch(
    workgroupSize: number,

    // read
    numReduces: number,

    // read-write
    inputEdgeReduces: ParallelStorageArray<RasterSplitReduceData>, // will into scanned form

    // write
    outputEdgeReduces: ParallelStorageArray<RasterSplitReduceData>
  ): Promise<void> {
    const logWorkgroupSize = Math.log2( workgroupSize );

    type WorkgroupValues = {
      reduces: ParallelWorkgroupArray<RasterSplitReduceData>;
    };

    // TODO: use atomic read+add+write for the output for high performance here?

    const kernel = new ParallelKernel<WorkgroupValues>( async context => {
      await context.start();

      const edgeIndex = context.globalId.x;
      const exists = edgeIndex < numReduces;

      let value = exists ? ( await inputEdgeReduces.get( context, context.globalId.x ) ) : RasterSplitReduceData.IDENTITY;

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

      await inputEdgeReduces.set( context, context.globalId.x, value );

      if ( context.localId.x === workgroupSize - 1 ) {
        await outputEdgeReduces.set( context, context.workgroupId.x, value );
      }
    }, () => ( {
      reduces: new ParallelWorkgroupArray( _.range( 0, workgroupSize ).map( () => RasterSplitReduceData.INDETERMINATE ), RasterSplitReduceData.INDETERMINATE )
    } ), [ inputEdgeReduces, outputEdgeReduces ], workgroupSize );

    await ( new ParallelExecutor( kernel ).dispatch( Math.ceil( numReduces / workgroupSize ) ) );
  }
}

alpenglow.register( 'ParallelRasterEdgeReduce', ParallelRasterEdgeReduce );
