// Copyright 2023, University of Colorado Boulder

/**
 * Assorted Parallel example tests
 *
 * See ParallelExecutor for more high-level documentation.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { ParallelContext, ParallelExecutor, ParallelKernel, ParallelStorageArray, ParallelWorkgroupArray } from '../imports.js';
import Random from '../../../dot/js/Random.js';

// eslint-disable-next-line bad-sim-text
const random = new Random();

QUnit.module( 'Parallel' );

QUnit.test( 'Reduce step', async assert => {
  const done = assert.async();

  const input = new ParallelStorageArray( _.range( 0, 1024 ).map( n => random.nextInt( 6000 ) ), NaN );
  const output = new ParallelStorageArray( [ 0, 0, 0, 0 ], NaN );

  const workgroupSize = 256;

  // const identity = ( n: number ) => n;
  const combine = ( a: number, b: number ) => a + b;

  type WorkgroupValues = { scratch: ParallelWorkgroupArray<number> };

  const kernel = new ParallelKernel<WorkgroupValues>( async ( context: ParallelContext<WorkgroupValues> ) => {
    await context.start();

    let value = await input.get( context, context.globalId.x );

    await context.workgroupValues.scratch.set( context, context.localId.x, value );

    const workgroupSize = context.kernel.workgroupX;
    const logWorkgroupSize = Math.log2( workgroupSize );

    for ( let i = 0; i < logWorkgroupSize; i++ ) {
      await context.workgroupBarrier();
      if ( context.localId.x + ( 1 << i ) < workgroupSize ) {
        const otherValue = await context.workgroupValues.scratch.get( context, context.localId.x + ( 1 << i ) );
        value = combine( value, otherValue );
      }

      await context.workgroupBarrier();
      await context.workgroupValues.scratch.set( context, context.localId.x, value );
    }

    if ( context.localId.x === 0 ) {
      await output.set( context, context.workgroupId.x, value );
    }
  },
  () => {
    return {
      scratch: new ParallelWorkgroupArray( _.range( 0, workgroupSize ).map( n => 0 ), NaN )
    };
  }, [ input, output ], workgroupSize );

  await ( new ParallelExecutor( kernel ).dispatch( 4 ) );

  assert.equal( output.data[ 0 ], _.sum( input.data.slice( 0, 256 ) ), 'Index 0' );
  assert.equal( output.data[ 1 ], _.sum( input.data.slice( 256, 512 ) ), 'Index 1' );
  assert.equal( output.data[ 2 ], _.sum( input.data.slice( 512, 768 ) ), 'Index 2' );
  assert.equal( output.data[ 3 ], _.sum( input.data.slice( 768, 1024 ) ), 'Index 3' );

  done();
} );
