// Copyright 2023-2024, University of Colorado Boulder

/**
 * Takes the input reductions and computes the inclusive prefix sum (scan) into it, in a form that can be used for
 * computing the exclusive prefix sum (zeros the last element). Outputs the reduction of the entire input into the
 * output reduces.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, ParallelExecutor, ParallelKernel, ParallelStorageArray, ParallelWorkgroupArray, RasterSplitReduceData } from '../../imports.js';

export default class ParallelRasterSplitReduce {
  public static async dispatch(
    workgroupSize: number,
    // read
    numReduces: number,
    // read-write
    inputReduces: ParallelStorageArray<RasterSplitReduceData>, // will process into scanned form

    // write
    outputReduces: ParallelStorageArray<RasterSplitReduceData>
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

      let value = exists ? ( await inputReduces.get( context, context.globalId.x ) ) : RasterSplitReduceData.IDENTITY;

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

      const isLastInWorkgroup = context.localId.x === workgroupSize - 1;

      if ( isLastInWorkgroup ) {
        await outputReduces.set( context, context.workgroupId.x, value );
      }

      // Set us up for "exclusive" scan, by zero-ing out the last entry
      await inputReduces.set( context, context.globalId.x, isLastInWorkgroup ? RasterSplitReduceData.IDENTITY : value );

    }, () => ( {
      reduces: new ParallelWorkgroupArray( _.range( 0, workgroupSize ).map( () => RasterSplitReduceData.INDETERMINATE ), RasterSplitReduceData.INDETERMINATE )
    } ), [ inputReduces, outputReduces ], workgroupSize );

    await ( new ParallelExecutor( kernel ).dispatch( Math.ceil( numReduces / workgroupSize ) ) );
  }
}

alpenglow.register( 'ParallelRasterSplitReduce', ParallelRasterSplitReduce );