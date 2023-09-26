// Copyright 2023, University of Colorado Boulder

/**
 * Assorted WGSL example tests
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { Binding, ComputeShader, DeviceContext, DualSnippet, wgsl_reduce_simple_single } from '../imports.js';
import Random from '../../../dot/js/Random.js';
import Vector3 from '../../../dot/js/Vector3.js';

// eslint-disable-next-line bad-sim-text
const random = new Random();

QUnit.module( 'Example' );

// TODO: deduplicate with SnippetTests

const devicePromise: Promise<GPUDevice | null> = ( async () => {
  try {
    const adapter = await navigator.gpu?.requestAdapter();
    return ( await adapter?.requestDevice() ) || null;
  }
  catch( e ) {
    return null;
  }
} )();

const asyncTestWithDevice = ( name: string, test: ( device: GPUDevice ) => Promise<string | null> ) => {
  QUnit.test( name, async assert => {
    const done = assert.async();

    const device = await devicePromise;

    if ( !device ) {
      assert.expect( 0 );
    }
    else {
      const result = await test( device );
      assert.ok( result === null, result || '' );
    }

    done();
  } );
};

asyncTestWithDevice( 'reduce_simple_single', async device => {
  const numbers = _.range( 0, 256 ).map( () => random.nextDouble() );

  const context = new DeviceContext( device );

  const snippet = DualSnippet.fromSource( wgsl_reduce_simple_single, {} );
  const shader = new ComputeShader( 'reduce_simple_single', snippet.toString(), [
    Binding.READ_ONLY_STORAGE_BUFFER,
    Binding.STORAGE_BUFFER
  ], device );

  const inputBuffer = context.createBuffer( 4 * 256 );
  device.queue.writeBuffer( inputBuffer, 0, new Float32Array( numbers ).buffer );

  const outputBuffer = context.createBuffer( 4 );
  const resultBuffer = context.createMapReadableBuffer( 4 );

  const encoder = device.createCommandEncoder( {
    label: 'the encoder'
  } );

  shader.dispatch( encoder, new Vector3( 1, 1, 1 ), [
    inputBuffer, outputBuffer
  ] );

  encoder.copyBufferToBuffer( outputBuffer, 0, resultBuffer, 0, resultBuffer.size );

  const commandBuffer = encoder.finish();
  device.queue.submit( [ commandBuffer ] );

  await resultBuffer.mapAsync( GPUMapMode.READ );
  const resultArrayBuffer = resultBuffer.getMappedRange();

  const outputArray = new Float32Array( 1 );
  outputArray.set( new Float32Array( resultArrayBuffer ) );

  resultBuffer.unmap();

  inputBuffer.destroy();
  outputBuffer.destroy();
  resultBuffer.destroy();

  const expectedValue = _.sum( numbers );
  const actualValue = outputArray[ 0 ];

  if ( Math.abs( expectedValue - actualValue ) > 1e-4 ) {
    return `expected ${expectedValue}, actual ${actualValue}`;
  }

  return null;
} );
